import * as THREE from 'three';

const KEYS = {
    'a': 65,
    's': 83,
    'w': 87,
    'd': 68,
};

class PCInputController {
    constructor(container) {

        this._container = container;
        this._initialize();

    }
    _initialize() {
        const scope = this;
        this.current = {
            leftButton: false,
            rightButton: false,
            mouseXDelta: 0,
            mouseYDelta: 0
        }
        this._keys = {};
        this._isLocked = false;


        this._container.requestPointerLock = this._container.requestPointerLock ||
            this._container.mozRequestPointerLock;
        document.exitPointerLock = document.exitPointerLock ||
            document.mozExitPointerLock;
        this._container.addEventListener("click", () => { scope._container.requestPointerLock() }, false)

        document.addEventListener('pointerlockchange', lockChangeAlert, false);
        document.addEventListener('mozpointerlockchange', lockChangeAlert, false);

        function lockChangeAlert() {
            if (document.pointerLockElement === scope._container || document.mozPointerLockElement === scope._container) {
                if (scope._isLocked === false) {
                    document.addEventListener("mousemove", updatePosition, false);
                    document.addEventListener('mousedown', onMouseDown, false);
                    document.addEventListener('mouseup', onMouseUp, false);
                    document.addEventListener('keydown', onKeyDown, false);
                    document.addEventListener('keyup', onKeyUp, false);
                    scope._isLocked = true;
                }
            } else {
                if (scope._isLocked === true) {
                    document.removeEventListener("mousemove", updatePosition, false);
                    document.removeEventListener('mousedown', onMouseDown, false);
                    document.removeEventListener('mouseup', onMouseUp, false);
                    document.removeEventListener('keydown', onKeyDown, false);
                    document.removeEventListener('keyup', onKeyUp, false);
                    scope._isLocked = false;
                    resetInputs();
                }
            }
        }

        function resetInputs() {
            scope.current = {
                leftButton: false,
                rightButton: false,
                mouseXDelta: 0,
                mouseYDelta: 0
            }
            scope._keys = {};
            scope._isLocked = false;
        }

        function updatePosition(e) {

            scope.current.mouseXDelta = e.movementX;
            scope.current.mouseYDelta = e.movementY;

        }

        function onKeyDown(e) {
            scope._keys[e.keyCode] = true;
        }

        function onKeyUp(e) {
            scope._keys[e.keyCode] = false;
        }

        function onMouseDown(e) {
            switch (e.button) {
                case 0:
                    scope.current.leftButton = true;
                    break;
                case 2:
                    scope.current.rightButton = true;
                    break;
            }
        }

        function onMouseUp(e) {
            switch (e.button) {
                case 0:
                    scope.current.leftButton = false;
                    break;
                case 2:
                    scope.current.rightButton = false;
                    break;
            }
        }
    }




    key(keyCode) {
        return !!this._keys[keyCode];
    }
    update(clockDelta) {

        this.current.mouseXDelta = 0;
        this.current.mouseYDelta = 0;

    }
}

class FirstPersonController {
    constructor(camera, container, scene, userHeight, moveSpeed) {
        const scope = this;

        this._camera = camera;
        this._scene = scene;
        this._container = container;
        this._input = new PCInputController(container); //pending, it may be outside, in controller class
        this._userHeight = userHeight != null ? userHeight : 1.65;
        this._gravity = 9.81;

        this._userStepHeight = 0.5;
        this._minStepDistance = 1.65 - this._userStepHeight; //1.15;

        this._rotation = new THREE.Quaternion();
        this._position = new THREE.Vector3(0, this._userHeight, 0);
        this._phi = 0;
        this._theta = 0;

        this._moveSpeed = moveSpeed == null ? 0.25 : moveSpeed;

        this._limits = {
            xmin: null,
            xmax: null,
            ymin: null,
            ymax: null,
            zmin: null,
            zmax: null
        };
        this._limitsSet = false;
        this._down = new THREE.Vector3(0, -1, 0)

        this._raycaster = null;
        this._fwdRaycaster = null;

        SetupRaycasters();

        function SetupRaycasters() {
            let raycaster = new THREE.Raycaster();
            raycaster.layers.disableAll();
            raycaster.layers.enable(30); //only objects in layer 30

            //console.log(raycaster)
            scope._raycaster = raycaster;

            raycaster = new THREE.Raycaster();
            raycaster.layers.disableAll();
            raycaster.layers.enable(30);
            raycaster.far = 0.5;

            scope._fwdRaycaster = raycaster;
        }
    }

    update(clockDelta) {
        this._updateRotation(clockDelta);
        this._updateTranslation(clockDelta);
        this._updateCamera();
        this._input.update(clockDelta);
    }
    setPosition(position) {
        this._position.set(position.x, position.y + this._userHeight, position.z);
    }
    getPosition() {
        return this._position;
    }
    setLimits(xmin, xmax, ymin, ymax, zmin, zmax) {
        console.log("limits set!");
        this._limits = {
            xmin: xmin,
            xmax: xmax,
            ymin: ymin,
            ymax: ymax,
            zmin: zmin,
            zmax: zmax
        }
        console.log(this._limits);
        this._limitsSet = true;
    }
    setSpeed(moveSpeed) {
        this._moveSpeed = moveSpeed;
    }
    _updateCamera() {
        this._camera.quaternion.copy(this._rotation);
        this._camera.position.copy(this._position);
    }
    _updateTranslation(clockDelta) {
        const forwardVelocity = ((this._input.key(KEYS.w) ? 1 : 0) + (this._input.key(KEYS.s) ? -1 : 0)) * this._moveSpeed;
        const sideVelocity = ((this._input.key(KEYS.a) ? 1 : 0) + (this._input.key(KEYS.d) ? -1 : 0)) * this._moveSpeed;

        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._phi);

        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(qx);
        //console.log(forward);
        forward.multiplyScalar(forwardVelocity * clockDelta * 10);

        const side = new THREE.Vector3(-1, 0, 0);
        side.applyQuaternion(qx);
        side.multiplyScalar(sideVelocity * clockDelta * 10);


        this._position.add(forward);
        this._position.add(side);

        if (forwardVelocity != 0) {
            if (this._checkCollisionWithDirection(this._position, forward)) {
                this._position.sub(forward);
            }
        }
        if (sideVelocity != 0) {
            if (this._checkCollisionWithDirection(this._position, side)) {
                this._position.sub(side);
            }
        }


        const hit = this._checkFloorColision(this._position)
        if (hit != null) {
            if (hit.distance < this._userHeight - 0.001) {
                if (hit.distance > this._minStepDistance) {
                    //this._position.y = this._userHeight + hit.point.y;
                    this._position.y += (this._userHeight - hit.distance) * clockDelta * 10;
                    if (this._position.y + 0.005 > (this._userHeight + hit.point.y)) {
                        this._position.y = this._userHeight + hit.point.y;
                    }
                } else {
                    this._position.sub(forward);
                    this._position.sub(side);
                }
            } else {
                if (hit.distance > this._userHeight + 0.01) {
                    let sub = clockDelta * this._gravity;
                    const dif = hit.distance - this._userHeight;
                    if (sub > dif)
                        sub = dif;

                    this._position.y -= sub;
                }

            }
            //console.log(hit);
        }


        if (this._limitsSet) {
            this._checkForLimits();
        }
        //console.log(this._checkFloorColision(this._position));

    }

    _checkCollisionWithDirection(position, direction) {
        this._fwdRaycaster.set(position, direction);
        if (this._fwdRaycaster.intersectObjects(this._scene.children, true)[0] != null)
            return true;
        // this._fwdRaycaster.set(new THREE.Vector3(position.x, position.y - this._minStepDistance, position.z), direction)
        // if (this._fwdRaycaster.intersectObjects(this._scene.children, true)[0] != null) {
        //     console.log("collided");
        //     return true;
        // }
        return false;
    }

    _checkFloorColision(position) {
        this._raycaster.set(position, this._down);
        //const hits = this._raycaster.intersectObjects(this._scene.children, true);
        const hit = this._raycaster.intersectObjects(this._scene.children, true)[0];
        return hit
        if (hit != null) {
            return hit
            const tarObj = hit.object.userData.gameObject;
            if (tarObj != null) {
                if (tarObj.userData.teleport != null)
                    return hit
            }
        }
        return null;
    }

    _checkForLimits() {

        //this._raycaster.set(this._camera, );
        //this._raycaster.intersectObjects(_interactable, true);
        if (this._limits.xmin != null)
            if (this._position.x < this._limits.xmin)
                this._position.x = this._limits.xmin;
        if (this._limits.xmax != null)
            if (this._position.x > this._limits.xmax)
                this._position.x = this._limits.xmax;

        if (this._limits.ymin != null)
            if (this._position.y < this._limits.ymin)
                this._position.y = this._limits.ymin;
        if (this._limits.ymax != null)
            if (this._position.y > this._limits.ymax)
                this._position.y = this._limits.ymax;

        if (this._limits.zmin != null)
            if (this._position.z < this._limits.zmin)
                this._position.z = this._limits.zmin;
        if (this._limits.zmax != null)
            if (this._position.z > this._limits.zmax)
                this._position.z = this._limits.zmax;
    }
    _updateRotation(clockDelta) {

        const xh = this._input.current.mouseXDelta / window.innerWidth;
        const yh = this._input.current.mouseYDelta / window.innerHeight;

        this._phi += -xh * 5; // 5 = speed
        this._theta = THREE.MathUtils.clamp(this._theta + -yh * 5, -Math.PI / 3, Math.PI / 3); // math.pi/3

        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._phi);
        const qz = new THREE.Quaternion();
        qz.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this._theta);

        const q = new THREE.Quaternion();
        q.multiply(qx);
        q.multiply(qz);

        this._rotation.copy(q);
    }
}

export { FirstPersonController }