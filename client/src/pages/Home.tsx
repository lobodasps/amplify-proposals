import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Zap, Target, FileText, BookOpen, FolderOpen, TrendingUp,
  Globe, BarChart3, FileSignature, Users, ArrowRight, CheckCircle2,
  Sparkles, Shield, Layers
} from "lucide-react";
import { useEffect } from "react";

const FEATURES = [
  { icon: Target, label: "Pursuit Intelligence", desc: "AI-scored go/no-go analysis and win-theme generation for every opportunity.", color: "text-blue-500" },
  { icon: Sparkles, label: "AI Proposal Assembly", desc: "RFP shredding, compliance matrix, and AI-generated first drafts from your firm's knowledge.", color: "text-violet-500" },
  { icon: FileText, label: "Resume Tailoring Engine", desc: "Automatically reformat staff resumes to match RFP key-personnel requirements.", color: "text-indigo-500" },
  { icon: BookOpen, label: "AEC Knowledge Hub", desc: "Centralized repository for projects, resumes, boilerplate, and qualifications.", color: "text-teal-500" },
  { icon: FolderOpen, label: "Digital Asset Management", desc: "Tag, search, version, and insert images and documents directly into proposals.", color: "text-emerald-500" },
  { icon: Globe, label: "Opportunity Ingestion", desc: "Auto-scrape NJ/NY/NYC agency portals and score opportunities against your capabilities.", color: "text-amber-500" },
  { icon: TrendingUp, label: "Bid Pipeline & KPIs", desc: "Win/loss tracking, hit-rate reporting, backlog conversion, and executive dashboards.", color: "text-orange-500" },
  { icon: FileSignature, label: "Contract Management", desc: "Contract records, milestones, key dates, and linked proposal references.", color: "text-rose-500" },
  { icon: Users, label: "Collaborative Workflows", desc: "Task assignment, SME review requests, comment threads, and approval workflows.", color: "text-cyan-500" },
  { icon: BarChart3, label: "InDesign-Ready Export", desc: "JSON/XML/CSV data packages for Adobe Data Merge and future UXP plugin integration.", color: "text-purple-500" },
  { icon: Shield, label: "Role-Based Permissions", desc: "9 named roles with scoped access across every module.", color: "text-slate-500" },
  { icon: Layers, label: "Portable Architecture", desc: "Supabase/Postgres-first, Docker-ready, and replatform-friendly for any cloud.", color: "text-gray-500" },
];

const SERVICE_LINES = [
  { label: "Special Inspections", color: "badge-special-inspections" },
  { label: "Construction Management", color: "badge-construction-management" },
  { label: "Traffic Engineering", color: "badge-traffic-engineering" },
  { label: "Landscape / Streetscape", color: "badge-landscape-streetscape" },
  { label: "Environmental", color: "badge-environmental" },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amplify-gradient flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-800 text-foreground">Amplify</span>
              <span className="font-display font-800 text-primary"> Proposals</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex text-xs font-medium border-primary/30 text-primary">
              AEC Platform
            </Badge>
            <Button
              className="bg-amplify-gradient text-white hover:opacity-90 font-semibold shadow-md"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-amplify-gradient-subtle" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="container relative text-center max-w-4xl mx-auto">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 font-semibold px-4 py-1.5 text-sm animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Purpose-built for NJ/NY/NYC AEC Firms
          </Badge>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-900 text-foreground mb-6 animate-fade-in-up leading-[1.1]">
            Win More Work.
            <br />
            <span className="text-gradient">Amplify Every Proposal.</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in-up leading-relaxed" style={{ animationDelay: "80ms" }}>
            The AI-powered proposal intelligence platform for AEC firms. From opportunity discovery to contract execution — every pursuit, every proposal, every win.
          </p>

          {/* Service Lines */}
          <div className="flex flex-wrap gap-2 justify-center mb-10 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            {SERVICE_LINES.map((sl) => (
              <span key={sl.label} className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${sl.color}`}>
                {sl.label}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in-up" style={{ animationDelay: "160ms" }}>
            <Button
              size="lg"
              className="bg-amplify-gradient text-white hover:opacity-90 font-semibold text-base px-8 shadow-lg"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Get Started <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="font-semibold text-base px-8">
              View Demo
            </Button>
          </div>

          {/* Trust Signals */}
          <div className="mt-12 flex flex-wrap gap-6 justify-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "240ms" }}>
            {["SOC 2 Ready", "Role-Based Access", "Portable Postgres Schema", "InDesign Integration"].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-display font-800 text-foreground mb-4">
              Everything your BD and proposal teams need
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              12 integrated modules covering the full AEC pursuit lifecycle — built to win on G2 and in the field.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="animate-fade-in-up bg-card border border-border rounded-xl p-5 card-hover">
                  <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 ${f.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-700 text-sm text-foreground mb-1.5">{f.label}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <div className="bg-amplify-gradient rounded-3xl p-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,white,transparent_60%)]" />
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-90" />
            <h2 className="text-3xl font-display font-800 mb-4">Ready to amplify your proposals?</h2>
            <p className="text-white/80 mb-8 text-lg">
              Join AEC firms winning more public-agency work with AI-powered pursuit intelligence.
            </p>
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 font-bold text-base px-10 shadow-lg"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Start Now <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">Amplify-Proposals</span>
            <span>— AEC Growth Operations Platform</span>
          </div>
          <div>© 2026 Amplify-Proposals. Built for NJ/NY/NYC AEC firms.</div>
        </div>
      </footer>
    </div>
  );
}
