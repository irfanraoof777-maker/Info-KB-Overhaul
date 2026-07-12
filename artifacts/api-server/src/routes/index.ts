import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import healthRouter from "./health";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);

// ── Public: Trainers (no auth required — powers the About page) ──
router.get("/trainers", async (_req, res) => {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SECRET_KEY"];
    if (!url || !key) { res.json({ trainers: [] }); return; }
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase
      .from("trainers")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) { res.json({ trainers: [] }); return; }
    res.json({ trainers: data ?? [] });
  } catch {
    res.json({ trainers: [] });
  }
});

export default router;
