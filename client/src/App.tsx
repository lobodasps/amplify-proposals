import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pursuits from "./pages/Pursuits";
import PursuitDetail from "./pages/PursuitDetail";
import Proposals from "./pages/Proposals";
import ProposalWorkspace from "./pages/ProposalWorkspace";
import KnowledgeHub from "./pages/KnowledgeHub";
import Assets from "./pages/Assets";
import Personnel from "./pages/Personnel";
import Staff from "./pages/Staff";
import Projects from "./pages/Projects";
import Pipeline from "./pages/Pipeline";
import Opportunities from "./pages/Opportunities";
import Contracts from "./pages/Contracts";
import ContractDetail from "./pages/ContractDetail";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import AITools from "./pages/AITools";
import InDesignExport from "./pages/InDesignExport";
import Compliance from "./pages/Compliance";
import ContractAnalyzer from "./pages/ContractAnalyzer";
import Glossary from "./pages/Glossary";
import BidCalendar from "./pages/BidCalendar";
import Help from "./pages/Help";
import OpportunityDetail from "./pages/OpportunityDetail";
import DocumentShredder from "./pages/DocumentShredder";
import RfpWiki from "./pages/RfpWiki";
import AgentGuidelines from "./pages/AgentGuidelines";
import ProposalScorer from "./pages/ProposalScorer";
import ConflictDetector from "./pages/ConflictDetector";
import FileLibrary from "@/pages/FileLibrary";
import QbSync from "@/pages/QbSync";
import ProposalLaunchpad from "@/pages/ProposalLaunchpad";

/**
 * ProtectedRoute wrapper — redirects to /login if not authenticated.
 * Shows nothing while auth state is loading to avoid flash.
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />

      {/* Protected routes */}
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/pursuits">{() => <ProtectedRoute component={Pursuits} />}</Route>
      <Route path="/pursuits/:id">{() => <ProtectedRoute component={PursuitDetail} />}</Route>
      <Route path="/proposals">{() => <ProtectedRoute component={Proposals} />}</Route>
      <Route path="/proposals/:id">{() => <ProtectedRoute component={ProposalWorkspace} />}</Route>
      <Route path="/knowledge-hub">{() => <ProtectedRoute component={KnowledgeHub} />}</Route>
      <Route path="/assets">{() => <ProtectedRoute component={Assets} />}</Route>
      <Route path="/personnel">{() => <ProtectedRoute component={Personnel} />}</Route>
      <Route path="/staff">{() => <ProtectedRoute component={Staff} />}</Route>
      <Route path="/projects">{() => <ProtectedRoute component={Projects} />}</Route>
      <Route path="/pipeline">{() => <ProtectedRoute component={Pipeline} />}</Route>
      <Route path="/opportunities">{() => <ProtectedRoute component={Opportunities} />}</Route>
      <Route path="/contracts">{() => <ProtectedRoute component={Contracts} />}</Route>
      <Route path="/contracts/:id">{() => <ProtectedRoute component={ContractDetail} />}</Route>
      <Route path="/analytics">{() => <ProtectedRoute component={Analytics} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/ai-tools">{() => <ProtectedRoute component={AITools} />}</Route>
      <Route path="/indesign-export">{() => <ProtectedRoute component={InDesignExport} />}</Route>
      <Route path="/compliance">{() => <ProtectedRoute component={Compliance} />}</Route>
      <Route path="/contract-analyzer">{() => <ProtectedRoute component={ContractAnalyzer} />}</Route>
      <Route path="/glossary">{() => <ProtectedRoute component={Glossary} />}</Route>
      <Route path="/bid-calendar">{() => <ProtectedRoute component={BidCalendar} />}</Route>
      <Route path="/help">{() => <ProtectedRoute component={Help} />}</Route>
      <Route path="/resource-library">{() => <Redirect to="/knowledge-hub" />}</Route>
      <Route path="/file-library">{() => <ProtectedRoute component={FileLibrary} />}</Route>
      <Route path="/opportunities/:id">{() => <ProtectedRoute component={OpportunityDetail} />}</Route>
      <Route path="/document-shredder">{() => <ProtectedRoute component={DocumentShredder} />}</Route>
      <Route path="/rfp-wiki">{() => <ProtectedRoute component={RfpWiki} />}</Route>
      <Route path="/agent-guidelines">{() => <ProtectedRoute component={AgentGuidelines} />}</Route>
      <Route path="/proposal-scorer">{() => <ProtectedRoute component={ProposalScorer} />}</Route>
      <Route path="/conflict-detector">{() => <ProtectedRoute component={ConflictDetector} />}</Route>
      <Route path="/qb-sync">{() => <ProtectedRoute component={QbSync} />}</Route>
      <Route path="/launch">{() => <ProtectedRoute component={ProposalLaunchpad} />}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
