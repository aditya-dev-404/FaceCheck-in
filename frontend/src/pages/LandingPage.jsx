import { Link } from "react-router-dom";
import { MdAnalytics, MdArrowForward, MdCheckCircle, MdFaceRetouchingNatural, MdShield } from "react-icons/md";

const features = [
  {
    icon: MdFaceRetouchingNatural,
    title: "Kiosk check-in",
    body: "One shared device at the entrance recognizes each person and marks them present — no logins, no queues, no manual roll call.",
  },
  {
    icon: MdShield,
    title: "Spoof-review flagging",
    body: "Low-confidence matches are accepted but flagged with the captured frame, so an admin can review anything unusual later.",
  },
  {
    icon: MdAnalytics,
    title: "Category reporting & export",
    body: "Filter attendance by department or category and export the whole thing to CSV whenever you need records.",
  },
];

const steps = [
  { title: "Register your organization", body: "Create an admin account and get a unique org code and kiosk secret." },
  { title: "Add your members", body: "Add each person once — they enroll their face from any device with a login." },
  { title: "Set up the kiosk", body: "Point any browser at the kiosk screen and attendance starts marking itself." },
];

export default function LandingPage() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-surface-raised px-3 py-1 text-sm font-medium text-primary shadow-clay-sm">
          <MdCheckCircle aria-hidden="true" />
          Face recognition made simple
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-text sm:text-5xl">
          Attendance that <span className="text-primary">marks itself</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-text-muted sm:text-lg">
          FaceCheck-in replaces sign-in sheets and manual roll calls with a single kiosk
          that recognizes your team and logs attendance the moment they walk in.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/register" className="clay-btn-primary">
            Register your organization <MdArrowForward aria-hidden="true" />
          </Link>
          <Link to="/login" className="clay-btn-secondary">
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="clay-card">
              <div className="flex h-10 w-10 items-center justify-center rounded-clay-sm bg-surface-raised text-primary shadow-clay-inset">
                <f.icon aria-hidden="true" className="text-xl" />
              </div>
              <h3 className="mt-4 font-medium text-text">{f.title}</h3>
              <p className="mt-2 text-sm text-text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20">
        <h2 className="text-center text-xl font-medium text-text">How it works</h2>
        <div className="mt-6 space-y-4">
          {steps.map((s, i) => (
            <div key={s.title} className="clay-card flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-medium text-primary shadow-clay-sm">
                {i + 1}
              </div>
              <div>
                <h3 className="font-medium text-text">{s.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-text-muted">
        FaceCheck-in · Reliable attendance, one familiar face at a time.
      </footer>
    </div>
  );
}
