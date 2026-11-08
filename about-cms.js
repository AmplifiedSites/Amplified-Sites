
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const { data, error } = await window.supabaseClient
            .from("website_about")
            .select("*")
            .eq("id", 1)
            .maybeSingle();

        if (error) {
            console.error("ABOUT CMS LOAD ERROR:", error);
            return;
        }

        if (!data) return;

        document.getElementById("aboutSectionLabel").textContent =
            data.section_label || "";

        document.getElementById("aboutHeading").textContent =
            data.heading || "";

        // Combine both fields into one paragraph
        const paragraph = document.getElementById("aboutParagraph1");

        if (paragraph) {
            paragraph.textContent = data.paragraph_1 || "";
            paragraph.style.whiteSpace = "pre-line";
        }
        } catch (error) {
        console.error("ABOUT CMS ERROR:", error);
    }
});
