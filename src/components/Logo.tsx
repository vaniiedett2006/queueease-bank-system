interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
}

export function Logo({ size = 'md', variant = 'light' }: LogoProps) {
  const sizeClasses = {
    sm: { img: 'h-9 w-9', text: 'text-lg', sub: 'text-[10px]' },
    md: { img: 'h-11 w-11', text: 'text-xl', sub: 'text-xs' },
    lg: { img: 'h-14 w-14', text: 'text-2xl', sub: 'text-sm' },
    xl: { img: 'h-20 w-20', text: 'text-3xl', sub: 'text-base' },
  };
  const s = sizeClasses[size];
  const textColor = variant === 'light' ? 'text-white' : 'text-navy-700';
  const subColor = variant === 'light' ? 'text-navy-200' : 'text-gray-500';

  return (
    <div className="flex items-center gap-3">
      <img
        src="/queueease-logo.png"
        alt="QueueEase Logo"
        className={`${s.img} rounded-lg object-contain shrink-0`}
      />
      <div className="flex flex-col leading-tight">
        <span className={`${s.text} font-extrabold ${textColor} tracking-tight`}>
          QueueEase
        </span>
        <span className={`${s.sub} ${subColor} font-medium`}>
          Queue Management System
        </span>
      </div>
    </div>
  );
}
