import ResetPassword from "@/src/shared/Auth/ResetPassword";

type PageProps = {
  searchParams?: { verify?: string };
};

export default function Page({ searchParams }: PageProps) {
  const token = searchParams?.verify ?? "";
  return <ResetPassword activationToken={token} />;
}
