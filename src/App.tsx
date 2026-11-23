import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { VideoModal } from './components/VideoModal';
import { CinematicIntro } from './components/CinematicIntro';
import { TechGridBackground } from './components/TechGridBackground';
import { PageTransition } from './components/animations/PageTransition';

// Pages
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Projects } from './pages/Projects';
import { ProblemExchange } from './pages/ProblemExchange';
import { IdeaLab } from './pages/IdeaLab';
import { Challenges } from './pages/Challenges';
import { Events } from './pages/Events';
import { Opportunities } from './pages/Opportunities';
import { Contact } from './pages/Contact';
import { Apply } from './pages/Apply';
import { Dashboard } from './pages/Dashboard';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { Admin } from './pages/Admin';
import { LegalPolicyPage } from './pages/LegalPolicyPage';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.startsWith('/')) return hash;
    return window.location.pathname || '/';
  });

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [forceIntro, setForceIntro] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash.startsWith('/')) {
        setCurrentPath(hash);
      } else {
        setCurrentPath(window.location.pathname || '/');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Redirect legacy /problems route to /problem-exchange
  useEffect(() => {
    const base = currentPath.split('?')[0];
    if (base === '/problems' || base === '/problems/' || base.startsWith('/problems/')) {
      window.location.hash = '/problem-exchange';
      setCurrentPath('/problem-exchange');
    }
  }, [currentPath]);

  const navigate = (path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderCurrentPage = () => {
    // Strip query parameters for routing
    const base = currentPath.split('?')[0];

    if (base === '/problem-exchange' || base === '/problem-exchange/') {
      return <ProblemExchange navigate={navigate} />;
    }

    if (base.startsWith('/problem-exchange/')) {
      const problemId = decodeURIComponent(base.slice('/problem-exchange/'.length)).split('/')[0];
      if (problemId) {
        return <ProblemExchange navigate={navigate} problemId={problemId} />;
      }
      return <ProblemExchange navigate={navigate} />;
    }

    switch (base) {
      case '/about':
        return <About navigate={navigate} />;
      case '/projects':
        return <Projects navigate={navigate} />;
      case '/problems':
        return <ProblemExchange navigate={navigate} />;
      case '/ideas':
        return <IdeaLab navigate={navigate} />;
      case '/challenges':
        return <Challenges navigate={navigate} />;
      case '/events':
        return <Events navigate={navigate} />;
      case '/opportunities':
        return <Opportunities navigate={navigate} />;
      case '/support':
      case '/contact':
        return <Contact navigate={navigate} />;
      case '/apply':
        return <Apply navigate={navigate} />;
      case '/dashboard':
        return <Dashboard navigate={navigate} />;
      case '/verify':
        return <VerifyCertificate navigate={navigate} />;
      case '/admin':
        return <Admin navigate={navigate} />;
      case '/terms':
        return <LegalPolicyPage type="terms" navigate={navigate} />;
      case '/privacy':
        return <LegalPolicyPage type="privacy" navigate={navigate} />;
      case '/':
      default:
        return <Home navigate={navigate} openVideoModal={() => setIsVideoModalOpen(true)} />;
    }
  };

  return (
    <AuthProvider>
      {/* 1. Cinematic Website Opening */}
      <CinematicIntro
        forceShow={forceIntro}
        onComplete={() => {
          setIntroFinished(true);
          setForceIntro(false);
        }}
      />

      <div className="relative min-h-screen bg-[#0b0c0e] text-[#f4f4f0] flex flex-col font-sans selection:bg-[#CCFF00] selection:text-black overflow-x-hidden">
        {/* 2. Global Interactive Background VFX (Grid + Particles + Scanlines) */}
        <TechGridBackground />

        {/* 3. Header & Navigation */}
        <Navbar 
          currentPath={currentPath.split('?')[0]} 
          navigate={navigate} 
          openVideoModal={() => setIsVideoModalOpen(true)}
          replayIntro={() => setForceIntro(true)}
        />

        {/* 4. Page Content with Smooth Transition */}
        <main className="relative z-10 flex-1">
          <PageTransition routeKey={currentPath.split('?')[0]}>
            {renderCurrentPage()}
          </PageTransition>
        </main>

        {/* 5. Footer */}
        <Footer 
          navigate={navigate} 
          replayIntro={() => setForceIntro(true)}
        />

        {/* 6. Video Modal */}
        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
        />
      </div>
    </AuthProvider>
  );
}
