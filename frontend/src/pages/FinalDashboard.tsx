import { useEffect, useState } from "react";
import Sidebar, { type Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

// Mobile error copy intentionally avoids exposing the desktop localhost backend.
// The actual API base is configured centrally in src/api/pal.ts.
