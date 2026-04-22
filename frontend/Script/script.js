const menuCont = document.getElementById('menuCont')
const navNavBar = document.getElementById('navNavBar')
const closeNav = document.getElementById('closeNav')

function OpenMenu(){
    menuCont.classList.add('show')
}
function CloseMenu(){
    menuCont.classList.remove('show')
}

navNavBar.addEventListener("click", OpenMenu)
closeNav.addEventListener("click", CloseMenu)
document.addEventListener('click', function(e){
    if(!menuCont.contains(e.target) && !navNavBar.contains(e.target)){
        menuCont.classList.remove('show')
    }
})

const computeG = document.getElementById('computeG')
const table = document.querySelector('table tbody')
const idNumInput = document.getElementById('idNum')
const studentNameInput = document.getElementById('studentName')
const pmidGInput = document.getElementById('pmidG')
const midtGInput = document.getElementById('midtG')
const pFinalGInput = document.getElementById('pFinalG')
const finalGInput = document.getElementById('finalG')

let students = [];
let egNameId = 0;

// Re-calculate the auto ID when needed
function updateRowNumbers() {
    let currentAutoId = 0;
    const allRows = table.querySelectorAll('tr');
    
    allRows.forEach((row, index) => {
        const td1 = row.children[0];
        const td2 = row.children[1];
        
        // Count auto-generated users to maintain counter
        if ((td1 && td1.textContent.startsWith('#')) || (td2 && td2.textContent.startsWith('Student #'))) {
             currentAutoId++;
        }
    });
    
    egNameId = currentAutoId;
}

// Modal variables
const deleteModal = document.getElementById('deleteModal');
const deleteModalText = document.getElementById('deleteModalText');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

let resolveDeletePromise = null;

// Helper to wait for modal confirmation
function showDeleteModal(studentName) {
    if(!deleteModal) return confirm(`Are you sure you want to delete the grade for ${studentName}?`); // Fallback if modal HTML is missing
    
    deleteModalText.textContent = `Are you sure you want to delete the grade for ${studentName}?`;
    deleteModal.classList.add('show');
    
    return new Promise((resolve) => {
        resolveDeletePromise = resolve;
    });
}

if(cancelDeleteBtn && confirmDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.remove('show');
        if(resolveDeletePromise) resolveDeletePromise(false);
    });

    confirmDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.remove('show');
        if(resolveDeletePromise) resolveDeletePromise(true);
    });
}

// Draw a single table row
function renderRow(studentData) {
    const tr = document.createElement('tr');
    tr.dataset.id = studentData._id; // Store MongoDB object ID

    const td1 = document.createElement('td');
    td1.textContent = studentData.idNum || studentData.id; 
    tr.appendChild(td1);

    const td2 = document.createElement('td');
    td2.textContent = studentData.name;
    tr.appendChild(td2);

    const td3 = document.createElement('td');
    td3.textContent = studentData.avg;
    tr.appendChild(td3);

    const td4 = document.createElement('td');
    td4.innerHTML = studentData.remarks;
    tr.appendChild(td4);

    const td5 = document.createElement('td');
    td5.id = "td5";
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async function() {
        // Ask for confirmation before deleting via our custom modal promise
        const isConfirmed = await showDeleteModal(studentData.name);
        
        // If the user clicks "Cancel" (No), stop the deletion process
        if (!isConfirmed) {
            return; 
        }

        if(studentData._id) {
            try {
                const res = await fetch(`https://fullstackportal.onrender.com/api/grades/${studentData._id}`, {
                    method: 'DELETE'
                });
                if(res.ok) {
                    tr.remove();
                    updateRowNumbers();
                } else {
                    console.error("Failed to delete from DB");
                }
            } catch (err) {
                console.error("Failed to connect to backend", err);
            }
        }
    });
    td5.appendChild(removeBtn);
    tr.appendChild(td5);

    table.appendChild(tr);
}

// Load grades from MongoDB
async function loadGrades() {
    const userEmail = localStorage.getItem('email');
    if(!userEmail) return; // Don't load if not logged in

    try {
        const res = await fetch(`https://fullstackportal.onrender.com/api/grades?email=${encodeURIComponent(userEmail)}`);
        if (res.ok) {
            students = await res.json();
            table.innerHTML = ''; // clear table
            students.forEach(student => {
                renderRow(student);
            });
            updateRowNumbers();
        }
    } catch (err) {
        console.error("Failed to load grades from backend", err);
    }
}

// Compute & Add grade to MongoDB
async function tableGrade(){
    let avgGrade = 0;
    let remarks = '';

    let idNum = idNumInput.value;
    let studentName = studentNameInput.value;
    const pmid = parseFloat(pmidGInput.value);
    const midt = parseFloat(midtGInput.value);
    const pFinal = parseFloat(pFinalGInput.value);
    const final = parseFloat(finalGInput.value);

    // Calculate average grade
    avgGrade = (pmid + midt + pFinal + final) / 4;

    if(isNaN(avgGrade)) {
        alert("Please enter valid numerical grades before computing!");
        return;
    }

    // Determine remarks
    if (avgGrade < 50) {
        remarks = '<font color="darkred">Dropped</font>';
    } else if (avgGrade >= 50 && avgGrade < 75){
        remarks = '<font color="red">Failed</font>';
    } else if (avgGrade >= 75 && avgGrade <= 100) {
        remarks = '<font color="green">Passed</font>';
    } else {
        remarks = '<font color="blue">Alien</font>';
    }

    if(avgGrade > 0){
        egNameId++;

        if(idNum === "") idNum = `#${egNameId}`;
        if(studentName === "") studentName = `Student #${egNameId}`;

        const newStudent = {
            idNum: idNum,
            name: studentName,
            avg: avgGrade.toFixed(2),
            remarks: remarks,
            ownerEmail: localStorage.getItem('email')
        }; 

        try {
            const res = await fetch('https://fullstackportal.onrender.com/api/grades', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newStudent)
            });

            if (res.ok) {
                const savedStudent = await res.json();
                renderRow(savedStudent);
                updateRowNumbers();

                // Only clear input fields if successfully found and saved
                idNumInput.value = '';
                studentNameInput.value = '';
                pmidGInput.value = '';
                midtGInput.value = '';
                pFinalGInput.value = '';
                finalGInput.value = '';
                
            } else if (res.status === 404) {
                const errData = await res.json();
                alert(errData.error || "Incorrect Student ID! No registered student found.");
            } else {
                console.error("Failed to save grade to backend");
                alert("Database save failed! Make sure node backend is running.");
            }
        } catch (err) {
            console.error("Backend connection error", err);
            alert("Could not connect to the Backend! Have you ran 'node backend/app.js'?");
        }
    }
}

computeG.addEventListener("click", function(){
    tableGrade();
});

// Start up
loadGrades();
