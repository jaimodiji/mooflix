import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AdBlockContextType {
  isAdBlockDetected: boolean;
  isAdBlockOn: boolean;
  isAdsFreeMode: boolean;
  isAdSenseSafeMode: boolean;
  toggleAdsFreeMode: () => void;
  toggleAdSenseSafeMode: () => void;
  recheckAdBlock: () => Promise<boolean>;
  toggleAdBlock: () => void;
  setAdBlock: (val: boolean) => void;
}

const AdBlockContext = createContext<AdBlockContextType>({
  isAdBlockDetected: false,
  isAdBlockOn: false,
  isAdsFreeMode: true,
  isAdSenseSafeMode: false,
  toggleAdsFreeMode: () => {},
  toggleAdSenseSafeMode: () => {},
  recheckAdBlock: async () => false,
  toggleAdBlock: () => {},
  setAdBlock: () => {},
});

export const runAdBlockDetection = async (): Promise<boolean> => false;

export const AdBlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdsFreeMode] = useState<boolean>(true);

  const scrubAllInjectedAds = useCallback(() => {
    try {
      document.querySelectorAll(
        'script[src*="auctionr"], script[src*="heiressnicholasfitful"], script[src*="quge5"], script[src*="bancadeltempoidea"], script[src*="aarems"], script[src*="highperformanceformat"], script[src*="effectivecpmnetwork"], script[src*="adsbygoogle"], script[src*="wpadmngr"], #mooflix-monetag-multitag, #mooflix-adsterra-social'
      ).forEach(el => {
        try { el.remove(); } catch {}
      });

      document.querySelectorAll(
        'iframe[src*="auctionr"], iframe[src*="quge5"], iframe[src*="bancadeltempoidea"], iframe[src*="aarems"], iframe[src*="heiressnicholasfitful"], iframe[src*="highperformanceformat"], iframe[src*="effectivecpmnetwork"], [data-zone="292947"], [id*="zone_292947"], [class*="monetag"], [id*="monetag"], [id*="socialbar"], [id*="adsterra"], [class*="adsterra"], #mooflix-isolated-monetization-layer'
      ).forEach(el => {
        try { el.remove(); } catch {}
      });
    } catch {}
  }, []);

  useEffect(() => {
    document.body.classList.add('ads-free-mode');
    document.body.style.overflow = '';
    scrubAllInjectedAds();
    const timer = setTimeout(scrubAllInjectedAds, 200);
    return () => clearTimeout(timer);
  }, [scrubAllInjectedAds]);

  return (
    <AdBlockContext.Provider
      value={{
        isAdBlockDetected: false,
        isAdBlockOn: false,
        isAdsFreeMode,
        isAdSenseSafeMode: false,
        toggleAdsFreeMode: () => {},
        toggleAdSenseSafeMode: () => {},
        recheckAdBlock: async () => false,
        toggleAdBlock: () => {},
        setAdBlock: () => {},
      }}
    >
      {children}
    </AdBlockContext.Provider>
  );
};

export const useAdBlock = () => useContext(AdBlockContext);
export default AdBlockContext;
