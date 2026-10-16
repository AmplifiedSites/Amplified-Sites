
// =========================================
// AMPLIFIED SITES - PUBLIC LEGAL DOCUMENTS
// =========================================

async function loadPublicLegalDocuments() {

    // =========================================
    // LOAD LEGAL DOCUMENT LINKS IN FOOTER
    // =========================================

    const footerContainer =
        document.getElementById("publicLegalDocuments");

    if (footerContainer) {

        try {

            const { data: documents, error } = await publicSupabase
                .from("legal_documents")
                .select("slug, title")
                .eq("is_published", true)
                .order("created_at", { ascending: true });

            if (error) throw error;

            footerContainer.innerHTML = "";

            (documents || []).forEach(doc => {

                const link = document.createElement("a");

                link.href =
                    `legal.html?slug=${encodeURIComponent(doc.slug)}`;

                link.textContent = doc.title;
                link.className = "legal-footer-link";

                footerContainer.appendChild(link);

            });

        } catch (error) {
            console.error("Unable to load footer legal documents:", error);
        }
    }


    // =========================================
    // LOAD LEGAL DOCUMENT PAGE
    // =========================================

    const legalTitle =
        document.getElementById("legalPageTitle");

    const legalContainer =
        document.getElementById("legalPageSections");

    if (!legalTitle || !legalContainer) return;

    const pageName = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    let slug;

    if (pageName === "privacy.html") {
        slug = "privacy";
    } else if (pageName === "terms.html") {
        slug = "terms";
    } else if (pageName === "legal.html") {
        slug = new URLSearchParams(window.location.search)
            .get("slug");
    } else {
        return;
    }

    if (!slug) {
        legalTitle.textContent = "Document Not Found";
        legalContainer.replaceChildren();
        return;
    }

    try {

        // =========================================
        // LOAD PUBLISHED DOCUMENT
        // =========================================

        const { data: documentRecord, error: documentError } =
            await publicSupabase
                .from("legal_documents")
                .select("id, title, updated_at")
                .eq("slug", slug)
                .eq("is_published", true)
                .maybeSingle();

        if (documentError) throw documentError;

        if (!documentRecord) {
            legalTitle.textContent = "Document Not Available";
            legalContainer.replaceChildren();
            return;
        }

        // =========================================
        // LOAD DOCUMENT SECTIONS
        // =========================================

        const { data: sections, error: sectionsError } =
            await publicSupabase
                .from("legal_sections")
                .select("title, content, sort_order")
                .eq("document_id", documentRecord.id)
                .order("sort_order", { ascending: true });

        if (sectionsError) throw sectionsError;

        legalTitle.textContent = documentRecord.title;

        const fragment = document.createDocumentFragment();

        (sections || []).forEach((section, index) => {

            const item = document.createElement("div");
            item.className = "term-item";

            const header = document.createElement("div");
            header.className = "term-header";

            const number = document.createElement("div");
            number.className = "number";
            number.textContent = index + 1;

            const heading = document.createElement("h3");
            heading.textContent = section.title || "";

            const arrowWrapper = document.createElement("div");
            arrowWrapper.className = "arrow";

            const arrow = document.createElement("i");
            arrow.className = "fa-solid fa-chevron-down arrow";

            arrowWrapper.appendChild(arrow);

            header.append(number, heading, arrowWrapper);

            const content = document.createElement("div");
            content.className = "term-content";

            const paragraph = document.createElement("p");
            paragraph.style.whiteSpace = "pre-line";
            paragraph.textContent = section.content || "";

            content.appendChild(paragraph);
            item.append(header, content);

            fragment.appendChild(item);

        });

        // =========================================
        // DISPLAY DOCUMENT
        // =========================================

        // Remove previous content and loading message
        legalContainer.replaceChildren(fragment);

        // Add the last-updated date
        const lastUpdatedElement = document.createElement("div");
        lastUpdatedElement.className = "last-updated";

        legalContainer.appendChild(lastUpdatedElement);

        const lastUpdated =
            legalContainer.querySelector(".last-updated");

        if (lastUpdated && documentRecord.updated_at) {

            const date = new Date(documentRecord.updated_at);

            if (!Number.isNaN(date.getTime())) {
                lastUpdated.textContent =
                    "📅 Last updated: " +
                    date.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric"
                    });
            }
        }

    } catch (error) {
        console.error("Legal document loading failed:", error);
    }

}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        loadPublicLegalDocuments,
        { once: true }
    );
} else {
    loadPublicLegalDocuments();
}
