type Size = 'sm' | 'md' | 'lg';

interface ProductThumbnailProps {
  src?: string | null;
  name: string;
  size?: Size;
  className?: string;
}

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

/** A product's photo, or an initials tile when none has been uploaded yet. */
export function ProductThumbnail({ src, name, size = 'md', className }: ProductThumbnailProps) {
  const classes = ['bl-phototile', size !== 'md' ? `bl-phototile--${size}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  if (src) {
    return <img className={classes} src={src} alt={name} />;
  }

  return (
    <span className={classes} aria-hidden="true">
      <span className="bl-phototile__fallback">{initials(name)}</span>
    </span>
  );
}

export default ProductThumbnail;
