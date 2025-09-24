fetch("../client/slidebar.html")
.then(res => res.text())
.then(data => {
    document.getElementById("slidebar").innerHTML = data;

    // Inicializamos los eventos después de cargar la sidebar
    let sidebar = document.querySelector(".sidebar");
    let closeBtn = document.querySelector("#btn");
    let searchBtn = document.querySelector(".bx-search");

    function menuBtnChange() {
        if(sidebar.classList.contains("open")){
            closeBtn.classList.replace("bx-menu", "bx-menu-alt-right");
            document.body.classList.add("sidebar-open"); // agregamos clase
        } else {
            closeBtn.classList.replace("bx-menu-alt-right","bx-menu");
            document.body.classList.remove("sidebar-open"); // removemos clase
        }
    }

    closeBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        menuBtnChange();
    });

    searchBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        menuBtnChange();
    });
}); 