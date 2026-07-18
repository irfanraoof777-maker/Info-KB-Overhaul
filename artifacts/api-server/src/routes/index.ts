import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import healthRouter from "./health";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);

// ── Public: Labs (no auth required — powers the Lab Rentals page) ──
router.get("/labs", async (_req, res) => {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SECRET_KEY"];
    if (!url || !key) { res.json({ labs: [] }); return; }
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase
      .from("labs")
      .select("*")
      .eq("enabled", true)
      .order("created_at", { ascending: false });
    if (error) { res.json({ labs: [] }); return; }
    res.json({ labs: data ?? [] });
  } catch {
    res.json({ labs: [] });
  }
});

// ── Public: Single Lab (no auth required) ──
router.get("/labs/:id", async (req, res) => {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SECRET_KEY"];
    if (!url || !key) { res.status(404).json({ error: "Not found" }); return; }
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase
      .from("labs")
      .select("*")
      .eq("id", req.params.id)
      .eq("enabled", true)
      .single();
    if (error || !data) { res.status(404).json({ error: "Lab not found" }); return; }
    res.json({ lab: data });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

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
