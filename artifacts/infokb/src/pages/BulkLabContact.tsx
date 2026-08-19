import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
type Lab = { id: string; title: string };
const organizationTypes = [
  "Company",
  "Educational institution",
  "Government organization",
  "Non-profit organization",
  "Training provider",
  "Other",
];
const userRanges = [
  "1-10",
  "11-25",
  "26-50",
  "51-100",
  "101-250",
  "251-500",
  "500+",
];
const inputClass =
  "w-full px-4 py-3 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
export default function BulkLabContact() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labsError, setLabsError] = useState("");
  const [labIds, setLabIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    organizationType: "",
    userRange: "",
    otherLabDescription: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const otherSelected = labIds.includes("other");
  useEffect(() => {
    document.title = "Corporate & Bulk Lab Access | InfoKB";
    if (!supabase) {
      setLabsError(
        "Lab options are unavailable right now. Please try again later.",
      );
      return;
    }
    supabase
      .from("labs")
      .select("id, title")
      .eq("enabled", true)
      .order("title", { ascending: true })
      .then(({ data, error: dbError }) => {
        if (dbError)
          setLabsError(
            "Lab options are unavailable right now. Please try again later.",
          );
        else setLabs((data ?? []) as Lab[]);
      });
  }, []);
  const update = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const toggleLab = (id: string) =>
    setLabIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/contact-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiryType: "bulk_lab", ...form, labIds }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Unable to send your request. Please try again.",
        );
      setSubmitted(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Corporate &amp; Bulk Lab Access
          </h1>
          <p className="text-white/70 text-base max-w-2xl mx-auto">
            Tell us about your team or institution and we&apos;ll help plan the
            right hands-on lab access.
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="bg-card rounded-2xl border border-card-border p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-[#23B33A] mx-auto mb-5" />
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Request Received!
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Thank you. Our team will get in touch about your corporate or
                bulk lab requirements.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Request Bulk Access
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Fields marked with * are required.
              </p>
              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Full Name *">
                    <input
                      required
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Work Email *">
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className={inputClass}
                      placeholder="you@company.com"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Phone Number">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Company / Institution Name *">
                    <input
                      required
                      value={form.companyName}
                      onChange={(e) => update("companyName", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Organization Type *">
                    <select
                      required
                      value={form.organizationType}
                      onChange={(e) =>
                        update("organizationType", e.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Select organization type...</option>
                      {organizationTypes.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Number of Users *">
                    <select
                      required
                      value={form.userRange}
                      onChange={(e) => update("userRange", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select user range...</option>
                      {userRanges.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <fieldset>
                  <legend className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Lab(s) Required *
                  </legend>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-border p-3 space-y-2">
                    {labs.map((lab) => (
                      <label
                        key={lab.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={labIds.includes(lab.id)}
                          onChange={() => toggleLab(lab.id)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-sm text-foreground">
                          {lab.title}
                        </span>
                      </label>
                    ))}
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={otherSelected}
                        onChange={() => toggleLab("other")}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm font-medium text-foreground">
                        Other
                      </span>
                    </label>
                  </div>
                  {labsError && (
                    <p className="mt-2 text-sm text-destructive">{labsError}</p>
                  )}
                  {labIds.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Select at least one lab option.
                    </p>
                  )}
                </fieldset>
                {otherSelected && (
                  <Field label="Describe the Lab You Need *">
                    <textarea
                      required
                      value={form.otherLabDescription}
                      onChange={(e) =>
                        update("otherLabDescription", e.target.value)
                      }
                      rows={3}
                      className={`${inputClass} resize-none`}
                    />
                  </Field>
                )}
                <Field label="Message / Requirements">
                  <textarea
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    rows={5}
                    className={`${inputClass} resize-none`}
                    placeholder="Tell us about your training goals or requirements..."
                  />
                </Field>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={
                    submitting || labIds.length === 0 || Boolean(labsError)
                  }
                  className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {submitting ? "Sending Request..." : "Request Bulk Access"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
