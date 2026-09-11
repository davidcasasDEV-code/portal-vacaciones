import { redirect } from "next/navigation";
import { getContext } from "../lib/context.js";

export default async function HomePage() {
  const context = await getContext();
  redirect(context ? "/dashboard" : "/login");
}
