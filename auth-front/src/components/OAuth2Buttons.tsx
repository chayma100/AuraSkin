import React from "react";
import { Button } from "./ui/button";
import { Chrome, Github } from "lucide-react";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:8083";

function OAuth2Buttons() {
  return (
    <div className="space-y-3">
      {/* Google */}
      <a
        href={`${BASE_URL}/api/v1/auth/google`}
        className="block"
      >
        <Button
          type="button"
          variant="outline"
          className="w-full cursor-pointer flex items-center gap-3 rounded-2xl"
        >
          <Chrome className="w-5 h-5" /> Continue with Google
        </Button>
      </a>

      {/* GitHub */}
      <a
        href={`${BASE_URL}/api/v1/auth/github`}
        className="block"
      >
        <Button
          type="button"
          variant="outline"
          className="w-full flex cursor-pointer items-center gap-3 rounded-2xl"
        >
          <Github className="w-5 h-5" /> Continue with GitHub
        </Button>
      </a>
    </div>
  );
}

export default OAuth2Buttons;