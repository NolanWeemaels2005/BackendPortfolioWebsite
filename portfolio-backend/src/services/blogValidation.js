export const textFields = ["title", "summary", "context", "process", "learning", "reflection", "aiContribution", "humanContribution", "planning", "sources"];
export function publicationErrors(post) {
  const errors = [];
  for (const field of ["title", "summary", "context", "process", "learning", "reflection", "sources"]) {
    if (!post[field]?.trim()) errors.push(`${field} is verplicht voor publicatie.`);
  }
  for (const role of ["before", "after"]) {
    if (!post.media.some(item => item.role === role && item.type === "image")) {
      errors.push(`Voeg minstens één ${role === "before" ? "voor" : "na"}-afbeelding toe.`);
    }
  }
  if (post.aiUsed && (!post.aiContribution?.trim() || !post.humanContribution?.trim())) {
    errors.push("Beschrijf wat AI deed en wat jij zelf deed.");
  }
  return errors;
}
