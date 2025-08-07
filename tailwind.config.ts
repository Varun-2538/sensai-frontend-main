import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic':
                    'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
            },
            animation: {
                'pulse-slow': 'pulse 3s infinite',
                'bounce-slow': 'bounce 2s infinite',
            },
            colors: {
                'proctor-red': {
                    500: '#ef4444',
                    600: '#dc2626',
                    700: '#b91c1c',
                },
                'proctor-yellow': {
                    500: '#eab308',
                    600: '#ca8a04',
                },
                'proctor-green': {
                    500: '#22c55e',
                    600: '#16a34a',
                },
            },
        },
    },
    plugins: [],
}
export default config
