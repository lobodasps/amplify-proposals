import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Pursuits from "./pages/Pursuits";
import PursuitDetail from "./pages/PursuitDetail";
import Proposals from "./pages/Proposals";
import ProposalWorkspace from "./pages/ProposalWorkspace";
import KnowledgeHub from "./pages/KnowledgeHub";
import Assets from "./pages/Assets";
import Personnel from "./pages/Personnel";
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
import ResourceLibrary from "./pages/ResourceLibrary";
import OpportunityDetail from "./pages/OpportunityDetail";
import DocumentShredder from "./pages/DocumentShredder";
import RfpWiki from "./pages/RfpWiki";
import AgentGuidelines from "./pages/AgentGuidelines";
import ProposalScorer from "./pages/ProposalScorer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/pursuits" component={Pursuits} />
      <Route path="/pursuits/:id" component={PursuitDetail} />
      <Route path="/proposals" component={Proposals} />
      <Route path="/proposals/:id" component={ProposalWorkspace} />
      <Route path="/knowledge-hub" component={KnowledgeHub} />
      <Route path="/assets" component={Assets} />
      <Route path="/personnel" component={Personnel} />
      <Route path="/projects" component={Projects} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/opportunities" component={Opportunities} />
      <Route path="/contracts" component={Contracts} />
      <Route path="/contracts/:id" component={ContractDetail} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/ai-tools" component={AITools} />
      <Route path="/indesign-export" component={InDesignExport} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/contract-analyzer" component={ContractAnalyzer} />
      <Route path="/glossary" component={Glossary} />
      <Route path="/bid-calendar" component={BidCalendar} />
      <Route path="/help" component={Help} />
      <Route path="/resource-library" component={ResourceLibrary} />
      <Route path="/opportunities/:id" component={OpportunityDetail} />
      <Route path="/document-shredder" component={DocumentShredder} />
      <Route path="/rfp-wiki" component={RfpWiki} />
      <Route path="/agent-guidelines" component={AgentGuidelines} />
      <Route path="/proposal-scorer" component={ProposalScorer} />
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
