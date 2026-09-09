import { PrismaClient, GlobalRole } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs.filter((arg) => arg !== '--');
  const autoConfirm = args.includes('--yes') || args.includes('-y');
  const positionalArgs = args.filter((arg) => !arg.startsWith('-'));

  if (positionalArgs.length === 0) {
    console.error('Error: Email address argument is required.');
    console.error('Usage: pnpm --filter @nst/database bootstrap-admin -- <email> [--yes|-y]');
    process.exit(1);
  }

  const email = positionalArgs[0].trim().toLowerCase();
  if (!email.includes('@')) {
    console.error(`Error: "${email}" is not a valid email address.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, globalRole: true, fullName: true },
  });

  if (!user) {
    console.error(`\nError: User with email "${email}" was not found in the database.`);
    console.error('Users are provisioned upon their first login via Google OAuth.');
    console.error(`Please instruct the user to sign in to NST Events via Google OAuth at least once before running this promotion script.\n`);
    process.exit(1);
  }

  if (user.globalRole === GlobalRole.PLATFORM_ADMIN) {
    console.log(`\nUser "${email}" (${user.fullName}) is already a PLATFORM_ADMIN. No changes made.\n`);
    return;
  }

  const previousRole = user.globalRole;

  if (!autoConfirm) {
    console.log(`\nTarget User: ${user.fullName} <${user.email}> (ID: ${user.id})`);
    console.log(`Current Role: ${previousRole}`);
    console.log(`New Role:     ${GlobalRole.PLATFORM_ADMIN}`);
    console.log('\nWARNING: Granting PLATFORM_ADMIN provides full access to all platform resources and administrative actions.');
    const confirmed = await askConfirmation('Type "yes" to confirm promotion: ');
    if (!confirmed) {
      console.log('\nOperation aborted. No changes made.\n');
      return;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      globalRole: GlobalRole.PLATFORM_ADMIN,
    },
    select: { id: true, email: true, globalRole: true, fullName: true },
  });

  console.log(`\nSuccessfully promoted user "${updatedUser.email}" (${updatedUser.fullName}) to ${updatedUser.globalRole} (previous role: ${previousRole}).\n`);
}

main()
  .catch((err) => {
    console.error('Bootstrap platform admin failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
