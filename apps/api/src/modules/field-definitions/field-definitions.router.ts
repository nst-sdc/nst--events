import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { CreateFieldDefinitionSchema } from './field-definitions.schema';
import { fieldDefinitionsService } from './field-definitions.service';
import { ForbiddenError } from '../../lib/errors';
import { withUserContext } from '@nst/database';

const router: Router = Router();

// List all field definitions
router.get('/', authenticate, async (req, res, next) => {
  try {
    const fields = await fieldDefinitionsService.listFieldDefinitions();
    res.json({ data: fields });
  } catch (error) {
    next(error);
  }
});

// Create a field definition
router.post(
  '/',
  authenticate,
  validate(CreateFieldDefinitionSchema),
  async (req, res, next) => {
    try {
      const field = await withUserContext(req.user!.id, async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: req.user!.id },
          select: { globalRole: true },
        });

        if (!user) throw new ForbiddenError('User not found');

        let derivedClubId: string | null = null;
        // Allow platform/faculty admins unconditionally (derivedClubId remains null for platform-wide fields)
        if (!['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
          // Check if they are a club admin or core member in ANY club
          const membership = await tx.clubMembership.findFirst({
            where: {
              userId: req.user!.id,
              role: { in: ['CLUB_ADMIN', 'CORE_MEMBER'] },
              deletedAt: null,
            },
            select: { clubId: true },
          });

          if (!membership) {
            throw new ForbiddenError('Insufficient permissions to create field definitions');
          }

          derivedClubId = membership.clubId;
        }

        return fieldDefinitionsService.createFieldDefinition(
          {
            ...req.body,
            createdByClubId: derivedClubId ?? undefined,
          },
          tx as any
        );
      });

      res.status(201).json({ data: field });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
