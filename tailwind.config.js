const colors = require('tailwindcss/colors');

const pureBlackPalette = {
    50: '#FFFFFF',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A0A0A0',
    500: '#656B6B',
    600: '#313131',
    700: '#262626',
    800: '#1A1A1A',
    900: '#121212',
    950: '#0A0A0A',
};

const monochromePrimary = {
    50: '#000000',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#FFFFFF',
    500: '#FFFFFF',
    600: '#FFFFFF',
    700: '#E4E4E7',
    800: '#D4D4D8',
    900: '#1A1A1A',
    950: '#000000',
};

module.exports = {
    content: [
        './resources/scripts/**/*.{js,ts,tsx}',
        './resources/views/**/*.blade.php',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Inter"', 'system-ui', 'sans-serif'],
                serif: ['"Newsreader"', '"Playfair Display"', 'Georgia', 'serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
                header: ['"Newsreader"', '"Playfair Display"', 'Georgia', 'serif'],
            },
            colors: {
                black: '#000000',
                primary: monochromePrimary,
                gray: pureBlackPalette,
                neutral: pureBlackPalette,
                cyan: pureBlackPalette,
                emerald: colors.emerald,
                ink: {
                    bg: '#ffffff',
                    dark: '#1a1a1a',
                    border: '#dedfdf',
                    subtle: '#656b6b',
                    gray10: '#f1f1f1',
                    gray20: '#e9eaea',
                    brown10: '#fbfaf9',
                },
                stellar: {
                    bg: '#000000',
                    surface: '#0a0a0a',
                    card: '#121212',
                    'card-hover': '#1a1a1a',
                    border: '#262626',
                    'border-hover': '#313131',
                    muted: '#656b6b',
                    subtext: '#a0a0a0',
                    text: '#f3f4f6',
                    green: '#10b981',
                    'green-dark': '#064e3b',
                    'green-hero': '#0f3828',
                    'green-light': '#34d399',
                    red: '#ef4444',
                },
            },
            fontSize: {
                '2xs': '0.625rem',
            },
            transitionDuration: {
                250: '250ms',
            },
            borderColor: theme => ({
                default: '#262626',
            }),
        },
    },
    plugins: [
        require('@tailwindcss/line-clamp'),
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
    ]
};
