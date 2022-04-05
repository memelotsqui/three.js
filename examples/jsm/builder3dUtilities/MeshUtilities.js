import * as THREE from 'three';
import * as BufferGeometryUtils from '../utils/BufferGeometryUtils.js';

class MeshUtilities {
    // BATCHING: IS IT CALLED FOR ALL OBJECTS THAT SHARE THE SAME MATERIAL?, OR ONLY FOR THE CHILDS OF TARGET OBJECT
    static CombineChilds(object, batching) {
        let materialMeshes = [];

        let resultData = {};
        resultData.originalMeshes = [];
        resultData.combinedMeshes = [];

        object.traverse((o) => {
            let merge = true;

            if (batching === true) {
                if (o.userData.gameObject !== undefined) {
                    if (o.userData.gameObject.userData.batching !== undefined) {
                        merge = o.userData.gameObject.userData.batching;
                    } else {
                        merge = false;
                    }
                }
            }
            if (o.userData.canMerge !== undefined) {
                merge = o.userData.canMerge;
            }
            if (o.isMesh && merge === true) {
                if (o.material !== undefined) {
                    if (o.material.length === undefined) {
                        let existingMaterial = false;
                        for (var i = 0; i < materialMeshes.length; i++) {
                            if (o.material === materialMeshes[i].material) {
                                existingMaterial = true;
                                materialMeshes[i].meshes.push(o);

                                //break;
                            }
                        }
                        if (existingMaterial === false) {
                            let matMesh = {};
                            matMesh.material = o.material;
                            matMesh.meshes = [o];

                            materialMeshes.push(matMesh);
                        }
                    }
                }
            }
        });

        if (batching === false) {
            object.userData.mesh = [];
        }
        for (let i = 0; i < materialMeshes.length; i++) {
            let combinedMesh = this.CombineMeshes(materialMeshes[i].meshes, materialMeshes[i].material, object, batching);
            if (combinedMesh !== null) {
                resultData.combinedMeshes.push(combinedMesh);
                if (batching) {
                    resultData.originalMeshes.push(...materialMeshes[i].meshes);
                }
            }

        }
        return resultData;
    }

    //when using batching, we keep originals
    static CombineMeshes(meshArray, material, parent, keepOriginals) {

        if (meshArray.length == 0) return null;
        //if (meshArray.length == 1) return meshArray[0];

        let hasPos = false;
        let hasNorms = false;
        let hasUV1s = false;
        let hasUV2s = false;
        let hasColors = false;

        for (var i = 0; i < meshArray.length; i++) {

            if (hasPos == false) hasPos = this.HasAttribute(meshArray[i].geometry, 'position');
            if (hasNorms == false) hasNorms = this.HasAttribute(meshArray[i].geometry, 'normal');
            if (hasUV1s == false) hasUV1s = this.HasAttribute(meshArray[i].geometry, 'uv')
            if (hasUV2s == false) hasUV2s = this.HasAttribute(meshArray[i].geometry, 'uv2')
            if (hasColors == false) hasColors = this.HasAttribute(meshArray[i].geometry, 'color')
        }

        const geometries = [];

        for (var i = 0; i < meshArray.length; i++) {
            const geom = new THREE.BufferGeometry();

            // if the object is negatively scaled, we must make sure to invert normals, when inverting indices, we also invert normals
            let inverseIndex = false;
            let scale = new THREE.Vector3();
            meshArray[i].getWorldScale(scale);
            let multScale = scale.x * scale.y * scale.z;
            if (multScale < 0)
                inverseIndex = true;

            let index = this.GetInt32Array(meshArray[i].geometry.index, inverseIndex);
            let position;

            if (index != null) geom.setIndex(index);
            if (hasPos) {
                position = this.GetFloat32Array(meshArray[i].geometry.getAttribute('position'), 3);
                if (position !== null) geom.setAttribute('position', position);
            }

            position.applyMatrix4(meshArray[i].matrixWorld);

            let itemCount = position.count;

            if (hasNorms) {
                let normal = this.GetFloat32Array(meshArray[i].geometry.getAttribute('normal'), 3, itemCount)
                if (normal !== null) geom.setAttribute('normal', normal);
            }

            if (hasUV1s) {
                let uv = this.GetFloat32Array(meshArray[i].geometry.getAttribute('uv'), 2, itemCount);
                if (uv !== null) geom.setAttribute('uv', uv);
            }

            if (hasUV2s) {
                let uv2 = this.GetFloat32Array(meshArray[i].geometry.getAttribute('uv2'), 2, itemCount);
                if (uv2 !== null) geom.setAttribute('uv2', uv2);
            }

            if (hasColors) {
                let color = this.GetFloat32Array(meshArray[i].geometry.getAttribute('color'), 3, itemCount);
                if (color !== null) geom.setAttribute('color', color);
            }
            geometries.push(geom);

            //scope.originalMeshes.push(meshArray[i]);

            if (keepOriginals === false) {
                // we remove from scene this object
                let removed = false;
                if (meshArray[i].userData !== undefined) {
                    if (meshArray[i].userData.gameObject !== undefined) {
                        if (meshArray[i].userData.gameObject !== parent) {
                            meshArray[i].userData.gameObject.parent = null;
                            removed = true;
                        }
                    }
                }
                if (removed == false)
                    meshArray[i].parent = null;
            } else {
                // we just turn visibility off, to keep colisions active
                meshArray[i].visible = false;
            }
        }

        const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries, true);
        geometry.computeBoundingSphere();

        const mesh = new THREE.Mesh(geometry, material);

        parent.add(mesh);
        if (keepOriginals === false) {
            //set layer same as parent
            parent.userData.mesh.push();
            mesh.userData = {};
            mesh.userData.gameObject = parent;
        } else {
            //set layer to 2 (ignore raycast)
        }

        return mesh;
    }

    static HasAttribute(geom, name) {
        if (geom.getAttribute(name) === undefined)
            return false;

        if (geom.getAttribute(name).count > 0)
            return true;
        return false;
    }

    static GetFloat32Array(array, itemSize, positionCount, offset) {

        if (array === undefined) {
            if (positionCount === undefined)
                return null;
            else {
                return this.CreateEmptyBufferData(positionCount, itemSize);
            }
        }
        if (array.constructor === THREE.InterleavedBufferAttribute) {
            return this.GetInterleaveBufferData(array.data, array.normalized, itemSize, array.offset, array.data.stride); //missing offset
        } else {
            if (array.constructor == Float32Array && offset === undefined)
                return array;
            else
                return this.GetBufferData(array, array.normalized, itemSize); //console.log(array);
        }
    }

    static GetInt32Array(array, inverse) {
        if (array === undefined)
            return null;

        let arrSize = array.count;
        let finalArr = new Int32Array(arrSize);
        if (!inverse) {
            for (var i = 0; i < arrSize; i++) {
                finalArr[i] = array.array[i];
            }
        } else {
            for (var i = 0; i < arrSize; i++) {
                finalArr[i] = array.array[array.count - 1 - i];
            }
        }
        return new THREE.BufferAttribute(finalArr, 1);
    }

    static GetInterleaveBufferData(array, normalized, itemSize, offset, stride) {

        let arrSize = array.count * itemSize;
        let arrFullSize = array.array.length;

        let finalArr = new Float32Array(arrSize);

        let factor = 1;
        if (normalized)
            factor = this.GetByteDivisionFactor(array.array.constructor);

        let count = 0;
        for (var j = offset; j < arrFullSize; j += stride) {
            for (var i = 0; i < itemSize; i++) {
                finalArr[count] = array.array[j + i] / factor;
                count++;
            }
        }
        return new THREE.BufferAttribute(finalArr, itemSize);
        //return finalArr;
    }

    static CreateEmptyBufferData(size, itemSize, fillSpace = 0) {
        let finalArr = new Float32Array(size);
        for (var i = 0; i < size; i++) {
            finalArr[i] = fillSpace;
        }
        return new THREE.BufferAttribute(finalArr, itemSize);
    }

    static GetBufferData(array, normalized, itemSize) {
        let arrSize = array.array.length;
        let finalArr = new Float32Array(arrSize);

        let factor = 1;
        if (normalized)
            factor = this.GetByteDivisionFactor(array.array.constructor);

        for (var i = 0; i < arrSize; i++) {
            finalArr[i] = array.array[i] / factor;
        }
        return new THREE.BufferAttribute(finalArr, itemSize);
    }

    static GetByteDivisionFactor(byteType) {
        switch (byteType) {
            case Uint8Array:
                return 255;
            case Int8Array:
                return 127;
            case Uint16Array:
                return 65535;
            case Int16Array:
                return 32768;
            default:
                return 1;
        }
    }
}

export { MeshUtilities }