"use client";

import dynamic from "next/dynamic";
import type { Selection } from "@/lib/investigation/recommendations";

const MiniKgPreviewFull = dynamic(
  () =>
    import("./MiniKgPreviewFull").then((m) => ({
      default: m.MiniKgPreviewFull,
    })),
  { ssr: false },
);

interface Props {
  selection: Selection;
}

export function MiniKgPreview({ selection }: Props) {
  return <MiniKgPreviewFull selection={selection} />;
}
