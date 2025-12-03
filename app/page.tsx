'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          Welcome to UI Designer
        </h1>
        <p className="text-xl text-muted-foreground">
          Master CSS and web design through interactive challenges and projects.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link href="/project/default">
            <Button size="lg" className="text-lg px-8 py-6">
              Start Playing
            </Button>
          </Link>
          <Link href="/help">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              Learn More
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
