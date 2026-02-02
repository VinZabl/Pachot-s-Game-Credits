import React from 'react';
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';

const Footer: React.FC = () => {
  const { siteSettings } = useSiteSettings();

  const socialLinks = [
    { icon: Facebook, url: siteSettings?.footer_social_1, label: 'Facebook' },
    { icon: Instagram, url: siteSettings?.footer_social_2, label: 'Instagram' },
    { icon: Twitter, url: siteSettings?.footer_social_3, label: 'Twitter' },
    { icon: Youtube, url: siteSettings?.footer_social_4, label: 'YouTube' },
  ].filter(link => link.url && link.url.trim() !== '');

  // Footer link columns - can be made configurable through site settings later
  const footerColumns = [
    {
      title: siteSettings?.site_name || "Pachot's Game Credits",
      links: [
        { label: siteSettings?.site_description || 'Your Perfect Game Credits Destination', url: '#' },
      ]
    },
    {
      title: 'SUPPORT',
      links: [
        { label: 'FAQ', url: '#' },
        { label: 'Contact Us', url: siteSettings?.footer_support_url || '#' },
        { label: 'Submit a Ticket', url: '#' },
      ]
    },
    {
      title: 'SERVICES',
      links: [
        { label: 'Game Credits', url: '#' },
        { label: 'Top Up', url: '#' },
      ]
    },
    {
      title: 'SHOWCASE',
      links: [
        { label: 'Popular Games', url: '#' },
        { label: 'All Games', url: '#' },
      ]
    },
    {
      title: 'ABOUT US',
      links: [
        { label: 'About', url: '#' },
        { label: 'Terms of Service', url: '#' },
        { label: 'Privacy Policy', url: '#' },
        { label: 'Resources', url: '#' },
      ]
    },
  ];

  return (
    <footer className="mt-16" style={{ backgroundColor: '#0d0d0d', borderTop: '1px solid rgba(255, 105, 180, 0.2)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Top Section - Multi-column Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-8">
          {footerColumns.map((column, index) => (
            <div key={index} className="flex flex-col">
              <h4 className="text-sm font-bold text-white uppercase mb-4">
                {column.title}
              </h4>
              <ul className="space-y-2">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.url}
                      className="text-xs text-gray-400 hover:text-pink-500 transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Separator Line */}
        <div id="footer-separator" className="border-t border-pink-500/30 my-8"></div>

        {/* Bottom Section - Social Media & Copyright */}
        <div className="flex flex-col items-center gap-6">
          {/* Social Media Icons - Centered */}
          {socialLinks.length > 0 && (
            <div className="flex items-center justify-center gap-4">
              {socialLinks.map((link, index) => {
                const Icon = link.icon;
                return (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full border-2 border-pink-500/50 flex items-center justify-center hover:bg-pink-500 hover:border-pink-500 transition-all duration-200"
                    aria-label={link.label}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </a>
                );
              })}
            </div>
          )}

          {/* Copyright - Centered at the bottom */}
          <div className="text-center">
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} {siteSettings?.site_name || "Pachot's Game Credits"}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
