import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

interface SessionInfo {
  currentCard: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  timerSeconds: number;
  /** Countdown length for the current card — denominator for the header progress bar. */
  timerTotalSeconds: number;
  /** True only while the per-card countdown is ticking; false once answered/timed-out. */
  timerRunning: boolean;
}

interface LearningContextValue {
  inSession: boolean;
  setInSession: (value: boolean) => void;
  exitRequested: boolean;
  requestExit: () => void;
  cancelExit: () => void;
  /** True while a blocking overlay (e.g. the report sheet) is open — suppresses study shortcuts. */
  overlayOpen: boolean;
  setOverlayOpen: (value: boolean) => void;
  sessionInfo: SessionInfo;
  updateSessionInfo: (info: Partial<SessionInfo>) => void;
}

const defaultSessionInfo: SessionInfo = {
  currentCard: 0,
  totalCards: 0,
  dailyGoalProgress: 0,
  dailyGoal: 20,
  timerSeconds: 30,
  timerTotalSeconds: 30,
  timerRunning: false,
};

const LearningContext = createContext<LearningContextValue>({
  inSession: false,
  setInSession: () => {},
  exitRequested: false,
  requestExit: () => {},
  cancelExit: () => {},
  overlayOpen: false,
  setOverlayOpen: () => {},
  sessionInfo: defaultSessionInfo,
  updateSessionInfo: () => {},
});

export function LearningProvider({ children }: { children: ReactNode }) {
  const [inSession, setInSession] = useState(false);
  const [exitRequested, setExitRequested] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>(defaultSessionInfo);

  const updateSessionInfo = useCallback((info: Partial<SessionInfo>) => {
    setSessionInfo((prev) => ({ ...prev, ...info }));
  }, []);

  return (
    <LearningContext.Provider
      value={{
        inSession,
        setInSession,
        exitRequested,
        requestExit: () => setExitRequested(true),
        cancelExit: () => setExitRequested(false),
        overlayOpen,
        setOverlayOpen,
        sessionInfo,
        updateSessionInfo,
      }}
    >
      {children}
    </LearningContext.Provider>
  );
}

export function useLearningSessions() {
  return useContext(LearningContext);
}
