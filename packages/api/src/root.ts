import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import * as store from "./store";

export const appRouter = router({
  getPoints: publicProcedure.query(() => store.list()),

  addPoint: publicProcedure
    .input(
      z.object({
        x: z.number().int(),
        y: z.number().int(),
        color: z.string(),
      })
    )
    .mutation(({ input }) => store.add(input)),

  deletePoint: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await store.remove(input.id);
    }),
});

export type AppRouter = typeof appRouter;
