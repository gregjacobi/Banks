import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

/**
 * BankLogo - Displays bank logo with graceful fallback to initials or icon
 *
 * Props:
 *   idrssd - Bank ID for fetching logo
 *   bankName - Bank name (used for generating initials fallback)
 *   size - 'sm' (24px), 'md' (32px), 'lg' (48px), or number in pixels
 *   variant - 'symbol' (square icon) or 'full' (full logo)
 *   showFallback - Show initials/icon when logo not found (default: true)
 *   className - Additional CSS classes
 */
function BankLogo({
  idrssd,
  bankName = '',
  size = 'md',
  variant = 'symbol',
  showFallback = true,
  className = ''
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Size mapping
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64
  };
  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 32;

  // Generate initials from bank name
  const getInitials = (name) => {
    if (!name) return '?';
    // Remove common suffixes and get first letters of significant words
    const cleaned = name
      .replace(/,?\s*(N\.?A\.?|NATIONAL ASSOCIATION|BANK|FSB|SSB|NA)$/i, '')
      .trim();
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  const initials = getInitials(bankName);
  const logoUrl = `/api/research/${idrssd}/logo${variant === 'symbol' ? '-symbol' : ''}`;

  // Fallback styles
  const fallbackStyle = {
    width: pixelSize,
    height: pixelSize,
    minWidth: pixelSize,
    minHeight: pixelSize,
    borderRadius: variant === 'symbol' ? '4px' : '4px',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: pixelSize * 0.4,
    fontWeight: 600,
    color: '#666',
    border: '1px solid #e0e0e0'
  };

  // If error occurred and no fallback wanted, render nothing
  if (hasError && !showFallback) {
    return null;
  }

  // Show fallback
  if (hasError) {
    return (
      <div style={fallbackStyle} className={className} title={bankName}>
        {initials || <Building2 size={pixelSize * 0.5} />}
      </div>
    );
  }

  return (
    <div
      style={{
        width: pixelSize,
        height: pixelSize,
        minWidth: pixelSize,
        minHeight: pixelSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      className={className}
    >
      {isLoading && showFallback && (
        <div style={{ ...fallbackStyle, opacity: 0.5 }}>
          {initials}
        </div>
      )}
      <img
        src={logoUrl}
        alt={bankName ? `${bankName} logo` : ''}
        style={{
          width: pixelSize,
          height: pixelSize,
          objectFit: 'contain',
          display: isLoading ? 'none' : 'block'
        }}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
}

export default BankLogo;
