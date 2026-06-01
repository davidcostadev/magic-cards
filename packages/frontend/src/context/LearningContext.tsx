import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

interface SessionInfo {
  currentCard: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  timerSeconds: number;
}

interface LearningContextValue {
  inSession: boolean;
  setInSession: (value: boolean) => void;
  exitRequested: boolean;
  requestExit: () => void;
  cancelExit: () => void;
  sessionInfo: SessionInfo;
  updateSessionInfo: (info: Partial<SessionInfo>) => void;
}

const defaultSessionInfo: SessionInfo = {
  currentCard: 0,
  totalCards: 0,
  dailyGoalProgress: 0,
  dailyGoal: 20,
  timerSeconds: 30,
};

const LearningContext = createContext<LearningContextValue>({
  inSession: false,
  setInSession: () => {},
  exitRequested: false,
  requestExit: () => {},
  cancelExit: () => {},
  sessionInfo: defaultSessionInfo,
  updateSessionInfo: () => {},
});

export function LearningProvider({ children }: { children: ReactNode }) {
  const [inSession, setInSession] = useState(false);
  const [exitRequested, setExitRequested] = useState(false);
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
