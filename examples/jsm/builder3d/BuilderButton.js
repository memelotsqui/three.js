class BuilderButton {
    constructor(buttonID, containerID, parameters, loadOnStart = false) {
        const scope = this;
        this.builder = null;
        if (loadOnStart === true) {
            loadBuilder();
        }

        if (parameters == null) parameters = {};

        let currentSession = null;
        let button = null

        button = document.getElementById(buttonID);
        if (button == null) {

            if ('xr' in navigator) {

                navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
                    if (supported) {
                        button = document.createElement('button');
                        button.id = 'BuilderButton';

                        stylizeElement(button);
                        button.onmouseenter = function() {

                            button.style.opacity = '1.0';

                        };
                        button.onmouseleave = function() {

                            button.style.opacity = '0.5';

                        };

                        document.body.appendChild(button);
                        button.onclick = buttonClick;
                    }

                });

            }

        } else {
            button.onclick = buttonClick;
        }

        function buttonClick() {
            if (scope.builder == null) {
                //create builder")
                loadBuilder(startVR);
            } else {
                //builder created, go in
                startVR();
            }
        }

        async function loadBuilder(callback, callbackModels) {
            const { Builder3D: builder } = await
            import (
                "./Builder3D.js"
            ).catch(err => {
                console.error(err);
            });
            scope.builder = new builder(containerID, parameters, false, scope);

            const tempUrl = new URL("xr-index.json", window.location.protocol + window.location.hostname);
            scope.builder.loadJsonSmart(tempUrl.href, null, callbackModels);
            if (callback !== undefined)
                callback();

        }

        function startVR() {
            scope.builder.enterVR();
        }

        function stylizeElement(element) {
            element.style.display = '';

            element.style.cursor = 'pointer';
            element.style.left = 'calc(50% - 70px)';
            element.style.width = '140px';
            element.textContent = 'ENTER WORLD';

            element.style.position = 'absolute';
            element.style.bottom = '20px';
            element.style.padding = '12px 6px';
            element.style.border = '1px solid #fff';
            element.style.borderRadius = '4px';
            element.style.background = 'rgba(0,0,0,0.1)';
            element.style.color = '#fff';
            element.style.font = 'normal 13px sans-serif';
            element.style.textAlign = 'center';
            element.style.opacity = '0.5';
            element.style.outline = 'none';
            element.style.zIndex = '999';

        }
    }
}
export { BuilderButton }