class ConvertMaterials {
    static convertMaterialsToType(gltf, TypedMaterial, changeAll = false) {
        let newMats = [];
        for (var i = 0; i < gltf.materials.length; i++) {

            newMats[i] = new TypedMaterial();
            this.changeMaterials(gltf.scene, gltf.materials[i], newMats[i], changeAll);
            TypedMaterial.prototype.copy.call(newMats[i], gltf.materials[i]);

        }
        gltf.materials.push(...newMats);
    }

    static changeMaterials(scene, oldMaterial, newMaterial, changeAll = false) {
        scene.traverse((o) => {
            if (o.isMesh) {
                if (o.material !== undefined) {
                    if (changeAll || o.userData.keepMat === undefined) {
                        if (o.material.length === undefined) {
                            if (o.material == oldMaterial) {
                                o.material = newMaterial;
                            }
                        } else {
                            for (var i = 0; i < o.material.length; i++) {
                                if (o.material[i] == oldMaterial) {
                                    o.material[i] = newMaterial;
                                }
                            }
                        }
                    }
                }
            }
        });
    }

}

export { ConvertMaterials }