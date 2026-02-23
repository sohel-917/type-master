import { Difficulty } from "./types";

export const PARAGRAPHS: Record<Difficulty, string[]> = {
  easy: [
    "The sun rises in the east and sets in the west every single day.",
    "A quick fox jumped over the lazy dog in the middle of the park.",
    "Learning to type fast is a useful skill for any student or worker.",
    "The cat sat on the mat and watched the mouse run across the floor.",
    "Rainy days are perfect for reading a good book and drinking tea."
  ],
  medium: [
    "Vite is a build tool that aims to provide a faster and leaner development experience for modern web projects.",
    "React makes it painless to create interactive UIs. Design simple views for each state in your application.",
    "TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.",
    "Tailwind CSS works by scanning all of your HTML files, JavaScript components, and other templates for class names.",
    "The importance of regular exercise cannot be overstated for maintaining both physical and mental health."
  ],
  hard: [
    "In the realm of software engineering, the ability to write clean, maintainable code is often more valuable than the ability to write clever, complex algorithms that are difficult for others to understand or modify.",
    "The rapid advancement of artificial intelligence has sparked intense debates regarding its potential impact on the global job market, ethical considerations of autonomous systems, and the future of human-computer interaction.",
    "Quantum computing represents a paradigm shift in computational power, leveraging the principles of superposition and entanglement to solve problems that are currently intractable for classical computers.",
    "Sustainable development requires a holistic approach that balances economic growth, social equity, and environmental protection to ensure that future generations can meet their own needs without compromise.",
    "The intricate dance of celestial bodies in our solar system is governed by the laws of physics, which scientists have spent centuries uncovering through rigorous observation, experimentation, and mathematical modeling."
  ]
};
