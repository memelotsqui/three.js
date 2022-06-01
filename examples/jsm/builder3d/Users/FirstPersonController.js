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
    constructor(camera, container, userHeight, moveSpeed) {

        this._camera = camera;
        this._container = container;
        this._input = new PCInputController(container);
        this.userHeight = userHeight != null ? userHeight : 0;

        this._rotation = new THREE.Quaternion();
        this._position = new THREE.Vector3();
        this._phi = 0;
        this._theta = 0;

        this._moveSpeed = moveSpeed == null ? 0.5 : moveSpeed;

        this._limits = {
            xmin: null,
            xmax: null,
            ymin: null,
            ymax: null,
            zmin: null,
            zmax: null
        };
        this._limitsSet = false;
    }
    update(clockDelta) {
        this._updateRotation(clockDelta);
        this._updateTranslation(clockDelta);
        this._updateCamera();
        this._input.update(clockDelta);
    }
    setPosition(position) {
        this._position.set(position.x, position.y + this.userHeight, position.z);
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
        forward.multiplyScalar(forwardVelocity * clockDelta * 10);

        const side = new THREE.Vector3(-1, 0, 0);
        side.applyQuaternion(qx);
        side.multiplyScalar(sideVelocity * clockDelta * 10);


        this._position.add(forward);
        this._position.add(side);
        this._position.y = this.userHeight;

        if (this._limitsSet) {
            this._checkForLimits();
        }
    }
    _checkForLimits() {
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