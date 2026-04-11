import type { Metadata } from "next";
import NaatRedirectClient from "./NaatRedirectClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ youtubeId?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { youtubeId } = await searchParams;
  const url = `https://naatproduction.appwrite.network/naat/${id}${
    youtubeId ? `?youtubeId=${youtubeId}` : ""
  }`;

  return {
    title: "Open in Naat Production",
    description: "Open this naat in the Naat Production app.",
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: "Open in Naat Production",
      description: "Open this naat in the Naat Production app.",
      url,
      siteName: "Naat Production",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Open in Naat Production",
      description: "Open this naat in the Naat Production app.",
    },
  };
}

export default async function NaatRedirectPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { youtubeId } = await searchParams;

  return <NaatRedirectClient naatId={id} youtubeId={youtubeId} />;
}
