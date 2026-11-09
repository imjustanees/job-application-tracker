const form = document.getElementById("application-form");
const applicationList = document.getElementById("application-list");
const statusInput = document.getElementById("status");
const statusFilter = document.getElementById("status-filter");
const searchInput = document.getElementById("application-search");
const message = document.getElementById("application-message");
const saveButton = form.querySelector('button[type="submit"]');

let savedApplications = [];

function renderApplications() {
    const selectedStatus = statusFilter.value;
    const searchText = searchInput.value.trim().toLowerCase();

    const applications = savedApplications.filter(function (application) {
        const matchesStatus =
            selectedStatus === "" || application.status === selectedStatus;

        const matchesSearch =
            application.company.toLowerCase().includes(searchText) ||
            application.jobTitle.toLowerCase().includes(searchText);

        return matchesStatus && matchesSearch;
    });

    applicationList.replaceChildren();

    if (applications.length === 0) {
        const item = document.createElement("li");
        item.textContent = savedApplications.length === 0
            ? "No applications logged yet."
            : "No applications match your search or filters.";
        applicationList.appendChild(item);
        return;
    }

    for (const application of applications) {
        const item = document.createElement("li");
        const dateLabel = application.dateApplied.split("-").reverse().join("/");

        item.textContent =
            `${application.jobTitle} at ${application.company} — ` +
            `${application.status} — ${dateLabel}`;
        const statusSelect = document.createElement("select");
        statusSelect.setAttribute(
            "aria-label",
            `Change status for ${application.jobTitle} at ${application.company}`
        );

        for (const status of ["Applied", "Interview", "Offer", "Rejected"]) {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            statusSelect.appendChild(option);
        }

        statusSelect.value = application.status;

        statusSelect.addEventListener("change", function () {
            updateApplicationStatus(application, statusSelect);
        });

        item.append(" ", statusSelect);
        applicationList.appendChild(item);
    }
}
async function updateApplicationStatus(application, statusSelect) {
    const newStatus = statusSelect.value;
    statusSelect.disabled = true;
    message.textContent = "";

    try {
        const response = await fetch("/api/applications/status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: application.id,
                status: newStatus
            })
        });

        if (!response.ok) {
            statusSelect.value = application.status;
            message.textContent = "Could not update the status. Try again.";
            return;
        }

        const savedApplication = savedApplications.find(function (entry) {
            return entry.id === application.id;
        });

        if (savedApplication) {
            savedApplication.status = newStatus;
        }

        renderApplications();
        message.textContent = "Application status updated.";
    } catch {
        statusSelect.value = application.status;
        message.textContent = "Could not confirm the update. Refresh the page to check.";
    } finally {
        statusSelect.disabled = false;
    }
}
async function loadApplications() {
    const response = await fetch("/api/applications", { cache: "no-store" });

    if (!response.ok) {
        throw new Error("Could not load applications.");
    }

    savedApplications = await response.json();
    renderApplications();
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const fields = new FormData(form);
    const application = {
        company: fields.get("company").trim(),
        jobTitle: fields.get("jobTitle").trim(),
        dateApplied: fields.get("dateApplied"),
        status: statusInput.selectedOptions[0].textContent.trim()
    };

    if (!application.company || !application.jobTitle) {
        message.textContent = "Enter a company and job title.";
        return;
    }

    saveButton.disabled = true;
    message.textContent = "";

    try {
        const response = await fetch("/api/applications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(application)
        });

        if (!response.ok) {
            message.textContent =
                "Could not save the application. Check the details and try again.";
            return;
        }

        form.reset();

        try {
            await loadApplications();
            message.textContent = "Application saved.";
        } catch {
            message.textContent =
                "Application saved. Refresh the page to update the list.";
        }
    } catch {
        message.textContent =
            "Could not confirm the save. Refresh the page before trying again.";
    } finally {
        saveButton.disabled = false;
    }
});

statusFilter.addEventListener("change", renderApplications);
searchInput.addEventListener("input", renderApplications);

loadApplications().catch(function () {
    message.textContent =
        "Could not load applications. Check that the Python server is running.";
});