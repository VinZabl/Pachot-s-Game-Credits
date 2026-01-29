import React, { useState, useEffect, useCallback } from 'react';

interface HeroProps {
  images: string[];
}

const SWIPE_THRESHOLD = 50;
const EDGE_CLICK_WIDTH = '33%'; // left/right third for prev/next

const Hero: React.FC<HeroProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Filter out empty images
  const validImages = images.filter(img => img && img.trim() !== '');

  const goNext = useCallback(() => {
    if (validImages.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
  }, [validImages.length]);

  const goPrev = useCallback(() => {
    if (validImages.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
  }, [validImages.length]);

  // Don't render if no images
  if (validImages.length === 0) return null;

  // Auto-advance every 5 seconds (loops: last -> first)
  useEffect(() => {
    if (validImages.length <= 1) return;
    const interval = setInterval(goNext, 5000);
    return () => clearInterval(interval);
  }, [validImages.length, goNext]);

  // Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (deltaX < -SWIPE_THRESHOLD) goNext();
    else if (deltaX > SWIPE_THRESHOLD) goPrev();
    setTouchStartX(null);
  };

  // Desktop: click on left/right edge to go prev/next
  const onContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (validImages.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    if (x < width * 0.33) goPrev();
    else if (x > width * 0.67) goNext();
  };

  return (
    <div className="relative w-full mb-4 md:mb-6 rounded-xl overflow-hidden select-none">
      <div
        className="relative w-full aspect-[21/9] md:aspect-[3/1] bg-cafe-darkCard cursor-default"
        onClick={onContainerClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="region"
        aria-label="Hero slideshow"
      >
        {/* Sliding strip: one slide = 100% of container; strip = n × 100% */}
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{
            width: `${validImages.length * 100}%`,
            transform: `translateX(-${(currentIndex / validImages.length) * 100}%)`,
          }}
        >
          {validImages.map((src, index) => (
            <div
              key={index}
              className="flex-shrink-0 h-full"
              style={{ width: `${100 / validImages.length}%` }}
            >
              <img
                src={src}
                alt={`Hero ${index + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Dot indicators */}
        {validImages.length > 1 && (
          <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 pointer-events-none">
            {validImages.map((_, index) => (
              <span
                key={index}
                className={`inline-block transition-all duration-300 rounded-full ${
                  index === currentIndex
                    ? 'w-8 md:w-10 h-2 bg-cafe-primary'
                    : 'w-2 h-2 bg-white/50'
                }`}
                aria-hidden
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Hero;
