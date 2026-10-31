type LogoProps = {
    className?: string;
};

/** The SpendLog wallet mark, without the app-icon tile. Same artwork as app/icon.svg. */
export default function Logo({ className }: LogoProps) {
    return (
        <svg viewBox="0 0 291 270" role="img" aria-label="SpendLog" className={className}>
            <path d="M50 13 64 0 78 13 92 0 106 13 120 0 134 13 148 0 162 13 176 0 190 13V80H50Z" fill="#B7C4E6" />
            <rect x="73" y="25" width="72" height="10" rx="5" fill="#454B66" />
            <rect x="73" y="44" width="49" height="10" rx="5" fill="#454B66" />
            <rect y="64" width="268" height="206" rx="38" fill="#677DB7" />
            <rect x="34" y="153" width="111" height="19" rx="9.5" fill="#E6E9EE" />
            <rect x="34" y="193" width="72" height="18" rx="9" fill="#B7C4E6" />
            <rect x="184.5" y="125.5" width="101" height="78" rx="21" fill="#454B66" stroke="#F4F5F4" strokeWidth="11" />
            <circle cx="229" cy="164" r="12" fill="#B7C4E6" />
        </svg>
    );
}
