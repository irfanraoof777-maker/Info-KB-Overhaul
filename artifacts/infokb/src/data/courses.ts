export type Category =
  | "All"
  | "Cloud"
  | "DevOps"
  | "AI & ML"
  | "Agile"
  | "Management"
  | "Data & AI"
  | "Database"
  | "Infrastructure"
  | "Cybersecurity"
  | "Networking"
  | "Programming"
  | "AI/ML"
  | "Other";

export interface Course {
  id: string;
  slug: string;
  title: string;
  category: Exclude<Category, "All">;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  description: string;
  longDescription: string;
  highlights: string[];
  curriculum: { module: string; topics: string[] }[];
  whoIsItFor: string[];
  instructor: string;
  rating: number;
  reviewCount: number;
  students: number;
  modules: number;
  price: number;
  originalPrice: number;
  onSale: boolean;
  imageGradient: string;
  imageAccent: string;
  thumbnailUrl?: string;
}

export const testimonials = [
  { name: "Rahul Sharma", role: "Cloud Engineer at TCS", text: "The AWS Solution Architect course at InfoKB was exceptional. The trainer explained complex concepts with real-world examples. Cleared my SAA-C03 exam on the first attempt.", rating: 5 },
  { name: "Priya Nair", role: "DevOps Lead at Infosys", text: "I enrolled for Docker & Kubernetes training and it completely transformed how I think about container orchestration. Hands-on labs were top-notch.", rating: 5 },
  { name: "Arjun Reddy", role: "Scrum Master at Wipro", text: "The CSM training was interactive and well-paced. Passed the Scrum Alliance exam within a week of completing the course. Highly recommend InfoKB for Agile certifications.", rating: 5 },
];
