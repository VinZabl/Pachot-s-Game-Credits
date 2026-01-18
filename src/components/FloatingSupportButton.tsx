import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';

const FloatingSupportButton: React.FC = () => {
  const { siteSettings, loading } = useSiteSettings();
  const supportLink = siteSettings?.footer_support_url || '#'; // Customer support link, default to # if not set
  const [bottomPosition, setBottomPosition] = useState(24); // 6 * 4 = 24px (bottom-6)
  const isLocked = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      // Find the footer separator line by ID
      const separator = document.getElementById('footer-separator');
      if (!separator) {
        // If footer separator not found, use default position
        setBottomPosition(24);
        return;
      }

      const separatorRect = separator.getBoundingClientRect();
      const separatorTop = separatorRect.top;
      const viewportHeight = window.innerHeight;
      const defaultBottom = 24; // bottom-6 = 24px
      const minSpacing = 16; // Minimum spacing above separator

      // Calculate distance from separator top to viewport bottom
      const separatorDistanceFromBottom = viewportHeight - separatorTop;
      
      // Calculate the button's bottom position if it were at default position
      const buttonBottomAtDefault = viewportHeight - defaultBottom;
      
      // Check if button would overlap or go below separator
      if (buttonBottomAtDefault >= separatorTop - minSpacing) {
        // Button would be at or below separator, lock it above
        const lockedBottom = separatorDistanceFromBottom + minSpacing;
        setBottomPosition(Math.max(lockedBottom, minSpacing));
        isLocked.current = true;
      } else {
        // Button is above separator, use normal position
        setBottomPosition(defaultBottom);
        isLocked.current = false;
      }
    };

    // Wait a bit for DOM to be ready, then set up scroll handler
    const timeoutId = setTimeout(() => {
      handleScroll(); // Initial call
      window.addEventListener('scroll', handleScroll, { passive: true });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Don't show while loading site settings
  if (loading) return null;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If no support URL is configured, prevent navigation and show alert
    if (!siteSettings?.footer_support_url || siteSettings.footer_support_url.trim() === '' || supportLink === '#') {
      e.preventDefault();
      alert('Support URL is not configured. Please contact the administrator.');
    }
  };

  return (
    <a
      href={supportLink}
      onClick={handleClick}
      target={supportLink !== '#' ? '_blank' : undefined}
      rel={supportLink !== '#' ? 'noopener noreferrer' : undefined}
      className="fixed right-6 w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white flex items-center justify-center shadow-lg hover:from-fuchsia-500 hover:to-pink-500 transition-all duration-200 transform hover:scale-110 z-50 glow-blue hover:glow-blue-strong"
      style={{ bottom: `${bottomPosition}px` }}
      aria-label="Customer Support"
    >
      <MessageCircle className="h-6 w-6 text-white" />
    </a>
  );
};

export default FloatingSupportButton;
