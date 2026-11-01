import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export interface QueryViolation {
  file: string;
  line: number;
  message: string;
}

export function checkSourceCodeForSessionViolations(code: string, filepath = 'test.ts'): QueryViolation[] {
  const sf = ts.createSourceFile(filepath, code, ts.ScriptTarget.Latest, true);
  const violations: QueryViolation[] = [];

  function visit(node: ts.Node) {
    // 1. Direct Prisma/transaction call on attendanceSession (e.g. tx.attendanceSession.findUnique({...}))
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const propName = expr.name.text;
        const target = expr.expression;
        if (ts.isPropertyAccessExpression(target) && target.name.text === 'attendanceSession') {
          const queryMethods = ['findUnique', 'findFirst', 'findMany', 'create', 'update', 'upsert', 'delete'];
          if (queryMethods.includes(propName)) {
            const firstArg = node.arguments[0];
            let hasSelect = false;
            if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
              for (const prop of firstArg.properties) {
                if (ts.isPropertyAssignment(prop) && prop.name.getText(sf) === 'select') {
                  hasSelect = true;
                  break;
                }
              }
            }
            if (!hasSelect) {
              const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
              violations.push({
                file: filepath,
                line: line + 1,
                message: `${target.getText(sf)}.${propName}() query lacks explicit select (qrSecret leak risk)`,
              });
            }
          }
        }
      }
    }

    // 2. Relation include containing attendanceSession or attendanceSessions without select
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'include') {
      if (ts.isObjectLiteralExpression(node.initializer)) {
        for (const relProp of node.initializer.properties) {
          if (ts.isPropertyAssignment(relProp)) {
            const relName = relProp.name.getText(sf);
            if (relName === 'attendanceSession' || relName === 'attendanceSessions') {
              let hasSelect = false;
              if (ts.isObjectLiteralExpression(relProp.initializer)) {
                for (const innerProp of relProp.initializer.properties) {
                  if (ts.isPropertyAssignment(innerProp) && innerProp.name.getText(sf) === 'select') {
                    hasSelect = true;
                    break;
                  }
                }
              }
              if (!hasSelect) {
                const { line } = sf.getLineAndCharacterOfPosition(relProp.getStart(sf));
                violations.push({
                  file: filepath,
                  line: line + 1,
                  message: `include.${relName} lacks explicit select (qrSecret leak risk)`,
                });
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return violations;
}

function scanDirectoryForViolations(dir: string): QueryViolation[] {
  let allViolations: QueryViolation[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      allViolations = allViolations.concat(scanDirectoryForViolations(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      const code = fs.readFileSync(fullPath, 'utf8');
      allViolations = allViolations.concat(checkSourceCodeForSessionViolations(code, fullPath));
    }
  }

  return allViolations;
}

describe('TASK P14: attendanceSession Query Guard & Secret Leakage Prevention', () => {
  it('1. All prisma.attendanceSession queries in apps/api/src have an explicit select', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const violations = scanDirectoryForViolations(srcDir);

    if (violations.length > 0) {
      console.error('Violations detected in apps/api/src:', violations);
    }

    assert.strictEqual(
      violations.length,
      0,
      `Expected 0 attendanceSession queries lacking explicit select, found: ${JSON.stringify(violations, null, 2)}`
    );
  });

  it('2. Guard catches direct findUnique without select', () => {
    const snippet = `
      const session = await tx.attendanceSession.findUnique({
        where: { id: "s-1" }
      });
    `;
    const violations = checkSourceCodeForSessionViolations(snippet, 'mock-service.ts');
    assert.strictEqual(violations.length, 1);
    assert.ok(violations[0].message.includes('findUnique() query lacks explicit select'));
  });

  it('3. Guard catches direct findMany without select', () => {
    const snippet = `
      return prisma.attendanceSession.findMany({
        where: { eventId: "e-1" }
      });
    `;
    const violations = checkSourceCodeForSessionViolations(snippet, 'mock-service.ts');
    assert.strictEqual(violations.length, 1);
    assert.ok(violations[0].message.includes('findMany() query lacks explicit select'));
  });

  it('4. Guard catches include: { attendanceSessions: true } without select', () => {
    const snippet = `
      const event = await tx.event.findUnique({
        where: { id },
        include: {
          attendanceSessions: true
        }
      });
    `;
    const violations = checkSourceCodeForSessionViolations(snippet, 'mock-service.ts');
    assert.strictEqual(violations.length, 1);
    assert.ok(violations[0].message.includes('include.attendanceSessions lacks explicit select'));
  });

  it('5. Guard catches include: { attendanceSessions: { where: ... } } without select', () => {
    const snippet = `
      const event = await tx.event.findUnique({
        where: { id },
        include: {
          attendanceSessions: {
            where: { deletedAt: null }
          }
        }
      });
    `;
    const violations = checkSourceCodeForSessionViolations(snippet, 'mock-service.ts');
    assert.strictEqual(violations.length, 1);
    assert.ok(violations[0].message.includes('include.attendanceSessions lacks explicit select'));
  });

  it('6. Guard passes direct query with explicit select', () => {
    const snippet = `
      const session = await tx.attendanceSession.findUnique({
        where: { id: "s-1" },
        select: { id: true, title: true }
      });
    `;
    const violations = checkSourceCodeForSessionViolations(snippet, 'mock-service.ts');
    assert.strictEqual(violations.length, 0);
  });

  it('7. Guard passes relation include with explicit select (e.g. ATTENDANCE_SESSION_SAFE_SELECT)', () => {
    const snippet = `
      const event = await tx.event.findUnique({
        where: { id },
        include: {
          attendanceSessions: {
            where: { deletedAt: null },
            select: ATTENDANCE_SESSION_SAFE_SELECT
          }
        }
      });
    `;
    const violations = checkSourceCodeForSessionViolations(snippet, 'mock-service.ts');
    assert.strictEqual(violations.length, 0);
  });
});
