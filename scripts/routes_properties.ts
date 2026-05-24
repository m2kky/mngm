
  // ─── Custom Properties & Views ───────────────────────────────────────────────

  app.get("/api/custom-properties", requireAuth, async (req: any, res) => {
    try {
      const { entityType, projectId } = req.query;
      const user = await storage.getUser(req.userId);
      if (!user?.agencyId) return res.status(403).send("No agency");

      const conditions = [
        eq(customProperties.agencyId, user.agencyId)
      ];
      if (entityType) {
        conditions.push(eq(customProperties.entityType, entityType as any));
      }
      if (projectId) {
        // Also fetch global properties for the agency alongside project-specific ones
        conditions.push(
          sql`${customProperties.projectId} = ${projectId} OR ${customProperties.projectId} IS NULL`
        );
      } else {
        conditions.push(isNull(customProperties.projectId));
      }

      const results = await db.select().from(customProperties).where(and(...conditions)).orderBy(customProperties.position);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/custom-properties", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user?.agencyId) return res.status(403).send("No agency");

      const data = insertCustomPropertySchema.parse({
        ...req.body,
        agencyId: user.agencyId,
        id: randomUUID(),
      });

      const [result] = await db.insert(customProperties).values(data).returning();
      res.status(201).json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/custom-properties/:id", requireAuth, async (req: any, res) => {
    try {
      const data = insertCustomPropertySchema.partial().parse(req.body);
      const [result] = await db.update(customProperties).set({ ...data, updatedAt: new Date() }).where(eq(customProperties.id, req.params.id)).returning();
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/custom-properties/:id", requireAuth, async (req: any, res) => {
    try {
      await db.delete(customProperties).where(eq(customProperties.id, req.params.id));
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/custom-properties/values", requireAuth, async (req: any, res) => {
    try {
      const { entityId, propertyId } = req.query;
      const conditions = [];
      if (entityId) conditions.push(eq(customPropertyValues.entityId, entityId as string));
      if (propertyId) conditions.push(eq(customPropertyValues.propertyId, propertyId as string));

      const results = await db.select().from(customPropertyValues).where(conditions.length > 0 ? and(...conditions) : undefined);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/custom-properties/values", requireAuth, async (req: any, res) => {
    try {
      const values = z.array(z.object({
        propertyId: z.string(),
        entityId: z.string(),
        value: z.any()
      })).parse(req.body);

      const results = [];
      for (const val of values) {
        const existing = await db.select().from(customPropertyValues).where(
          and(
            eq(customPropertyValues.propertyId, val.propertyId),
            eq(customPropertyValues.entityId, val.entityId)
          )
        );

        if (existing.length > 0) {
          const [updated] = await db.update(customPropertyValues)
            .set({ value: val.value, updatedAt: new Date() })
            .where(eq(customPropertyValues.id, existing[0].id))
            .returning();
          results.push(updated);
        } else {
          const [inserted] = await db.insert(customPropertyValues)
            .values({
              id: randomUUID(),
              propertyId: val.propertyId,
              entityId: val.entityId,
              value: val.value
            })
            .returning();
          results.push(inserted);
        }
      }
      res.json(results);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/views", requireAuth, async (req: any, res) => {
    try {
      const { entityType, projectId } = req.query;
      const user = await storage.getUser(req.userId);
      if (!user?.agencyId) return res.status(403).send("No agency");

      const conditions = [
        eq(views.agencyId, user.agencyId)
      ];
      if (entityType) {
        conditions.push(eq(views.entityType, entityType as any));
      }
      if (projectId) {
        conditions.push(
          sql`${views.projectId} = ${projectId} OR ${views.projectId} IS NULL`
        );
      } else {
        conditions.push(isNull(views.projectId));
      }

      const results = await db.select().from(views).where(and(...conditions)).orderBy(views.position);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/views", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user?.agencyId) return res.status(403).send("No agency");

      const data = insertViewSchema.parse({
        ...req.body,
        agencyId: user.agencyId,
        id: randomUUID(),
      });

      const [result] = await db.insert(views).values(data).returning();
      res.status(201).json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/views/:id", requireAuth, async (req: any, res) => {
    try {
      const data = insertViewSchema.partial().parse(req.body);
      const [result] = await db.update(views).set({ ...data, updatedAt: new Date() }).where(eq(views.id, req.params.id)).returning();
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/views/:id", requireAuth, async (req: any, res) => {
    try {
      await db.delete(views).where(eq(views.id, req.params.id));
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
