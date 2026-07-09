import React from 'react';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { usePaymentMethods } from '../hooks/usePaymentMethods';

interface FooterProps {
  compact?: boolean;
}

const Footer: React.FC<FooterProps> = ({ compact }) => {
  const { siteSettings } = useSiteSettings();
  const { paymentMethods, loading } = usePaymentMethods();

  // Get Facebook link or default to a placeholder
  const facebookUrl = siteSettings?.footer_social_1 || 'https://www.facebook.com/PachotsGameCredits';

  const renderPaymentBadge = (method: any) => {
    const name = (method.name || '').toLowerCase();
    const id = (method.id || '').toLowerCase();

    if (id.includes('gcash') || name.includes('gcash')) {
      return (
        <div key={method.uuid_id || method.id} className="px-4 py-2 rounded-xl bg-[#161922] border border-gray-800/50 flex items-center justify-center gap-1.5 shadow-sm">
          <div className="w-3.5 h-3.5 rounded-full bg-[#005cff] flex items-center justify-center text-[8px] font-bold text-white shadow-sm">G</div>
          <span className="text-[#005cff] font-extrabold text-xs sm:text-sm tracking-tight">
            GCash
          </span>
        </div>
      );
    }

    if (id.includes('maya') || name.includes('maya')) {
      return (
        <div key={method.uuid_id || method.id} className="px-4 py-2 rounded-xl bg-[#161922] border border-gray-800/50 flex items-center justify-center shadow-sm">
          <span className="text-[#00ff87] font-extrabold text-xs sm:text-sm tracking-tight">
            maya
          </span>
        </div>
      );
    }

    if (id.includes('shopee') || name.includes('shopee') || id.includes('spay') || name.includes('spay')) {
      return (
        <div key={method.uuid_id || method.id} className="px-4 py-2 rounded-xl bg-[#161922] border border-gray-800/50 flex items-center justify-center gap-1.5 shadow-sm">
          <span className="text-[#ee4d2d] font-bold text-xs sm:text-sm tracking-tight flex items-center">
            <span className="w-3.5 h-3.5 bg-[#ee4d2d] text-white rounded-md flex items-center justify-center text-[8px] font-black mr-1 shadow-sm">S</span>
            Pay
          </span>
        </div>
      );
    }

    if (id.includes('coins') || name.includes('coins')) {
      return (
        <div key={method.uuid_id || method.id} className="px-4 py-2 rounded-xl bg-[#161922] border border-gray-800/50 flex items-center justify-center gap-1.5 shadow-sm">
          <span className="text-[#0a5da6] font-extrabold text-xs sm:text-sm tracking-tight">
            coins.ph
          </span>
        </div>
      );
    }

    if (id.includes('gotyme') || name.includes('gotyme')) {
      return (
        <div key={method.uuid_id || method.id} className="px-4 py-2 rounded-xl bg-[#161922] border border-gray-800/50 flex items-center justify-center gap-1.5 shadow-sm">
          <div className="w-3.5 h-3.5 rounded-full border border-[#00d0c6] flex items-center justify-center bg-transparent shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[#00d0c6]"></div>
          </div>
          <span className="text-[#00d0c6] font-extrabold text-xs sm:text-sm tracking-tight">
            GoTyme
          </span>
        </div>
      );
    }

    // Fallback for other payment methods
    return (
      <div key={method.uuid_id || method.id} className="px-4 py-2 rounded-xl bg-[#161922] border border-gray-800/50 flex items-center justify-center shadow-sm">
        <span className="text-gray-300 font-bold text-xs sm:text-sm uppercase tracking-wider">
          {method.name}
        </span>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="w-full flex flex-col items-center pt-4 space-y-4 border-t border-gray-900/60 mt-4">
        {/* SUPPORTED PAYMENTS Header */}
        <div className="text-center mb-1">
          <h4 className="text-[10px] sm:text-xs font-extrabold tracking-widest text-[#ff007f] uppercase">
            Supported Payments
          </h4>
        </div>

        {/* Payment Badges Grid/Row (Loaded Dynamically) */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2 max-w-sm">
          {loading ? (
            <div className="text-[10px] text-gray-500 animate-pulse">Loading payments...</div>
          ) : paymentMethods.length > 0 ? (
            paymentMethods.map(renderPaymentBadge)
          ) : (
            <div className="text-[10px] text-gray-500">No payment methods available</div>
          )}
        </div>

        {/* Facebook Page with Verified Checkmark */}
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity duration-200 text-center px-4"
        >
          {/* Facebook Icon */}
          <svg className="h-4 w-4 text-white fill-current flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
          </svg>
          
          <span className="text-[10px] sm:text-xs text-gray-400 font-medium">
            Official Facebook Page:{' '}
            <span className="text-[#ff007f] font-bold inline-flex items-center gap-1">
              Pachot's Game Credits
              {/* Verified Badge Checkmark SVG */}
              <svg className="h-3.5 w-3.5 text-[#1877f2] fill-current flex-shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </span>
          </span>
        </a>
      </div>
    );
  }

  return (
    <footer className="w-full bg-[#0d0d0d] pt-8 pb-12 px-4 sm:px-6 lg:px-8 border-t border-gray-900/60 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        {/* Divider line at the top of footer elements */}
        <div id="footer-separator" className="w-full border-t border-gray-800/80 mb-8"></div>

        {/* SUPPORTED PAYMENTS Header */}
        <div className="text-center mb-5">
          <h4 className="text-xs sm:text-sm font-extrabold tracking-widest text-[#ff007f] uppercase">
            Supported Payments
          </h4>
        </div>

        {/* Payment Badges Grid/Row (Loaded Dynamically) */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10 max-w-2xl">
          {loading ? (
            <div className="text-xs text-gray-500 animate-pulse">Loading payments...</div>
          ) : paymentMethods.length > 0 ? (
            paymentMethods.map(renderPaymentBadge)
          ) : (
            <div className="text-xs text-gray-500">No payment methods available</div>
          )}
        </div>

        {/* Facebook Page with Verified Checkmark */}
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center flex-wrap gap-2 hover:opacity-90 transition-opacity duration-200 text-center px-4"
        >
          {/* Facebook Icon */}
          <svg className="h-5 w-5 text-white fill-current flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
          </svg>
          
          <span className="text-xs sm:text-sm text-gray-400 font-medium">
            Official Facebook Page:{' '}
            <span className="text-[#ff007f] font-bold inline-flex items-center gap-1">
              Pachot's Game Credits
              {/* Verified Badge Checkmark SVG */}
              <svg className="h-4 w-4 text-[#1877f2] fill-current flex-shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </span>
          </span>
        </a>
      </div>
    </footer>
  );
};

export default Footer;
