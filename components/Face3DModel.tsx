import { Asset } from "expo-asset";
import { ExpoWebGLRenderingContext, GLView } from "expo-gl";
import { Renderer, THREE } from "expo-three";
import React, { useRef, useState } from "react";
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PinchGestureHandler,
  PinchGestureHandlerGestureEvent,
  State,
} from "react-native-gesture-handler";

interface Face3DModelProps {
  onPointSelected: (point: {
    x: number;
    y: number;
    z: number;
    area: string;
  }) => void;
}

export default function Face3DModel({ onPointSelected }: Face3DModelProps) {
  const [selectedPoint, setSelectedPoint] = useState<{
    x: number;
    y: number;
    z: number;
    area: string;
  } | null>(null);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] =
    useState<string>("Đang tải model...");

  // Refs for 3D objects
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const selectedMarkerRef = useRef<THREE.Group | null>(null);
  const glViewRef = useRef<GLView>(null);

  // Gesture handler refs
  const tapRef = useRef(null);
  const panRef = useRef(null);
  const pinchRef = useRef(null);

  // Camera controls - improved values
  const controlsRef = useRef({
    zoom: 3,
    rotationX: Math.PI / 2,
    rotationY: 0,
    positionX: 0,
    positionY: 0,
    lastPinchScale: 1,
    isDragging: false,
    glViewWidth: 0,
    glViewHeight: 0,
    baseRotationX: Math.PI / 2,
    baseRotationY: 0,
    dragThreshold: 5, // Reduced threshold for better responsiveness
    startX: 0,
    startY: 0,
    totalDragDistance: 0,
  });

  // Simple OBJ parser as fallback
  const parseOBJ = (objText: string): THREE.BufferGeometry => {
    const vertices: number[] = [];
    const faces: number[] = [];

    const lines = objText.split("\n");

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);

      if (parts[0] === "v") {
        // Vertex
        vertices.push(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        );
      } else if (parts[0] === "f") {
        // Face - handle both triangles and quads
        const faceVertices = parts.slice(1).map((p) => {
          // Handle vertex/texture/normal format (v/vt/vn)
          return parseInt(p.split("/")[0]) - 1; // OBJ indices start at 1
        });

        if (faceVertices.length >= 3) {
          // Triangle
          faces.push(faceVertices[0], faceVertices[1], faceVertices[2]);

          if (faceVertices.length === 4) {
            // Quad - split into two triangles
            faces.push(faceVertices[0], faceVertices[2], faceVertices[3]);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setIndex(faces);
    geometry.computeVertexNormals();

    return geometry;
  };

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    // Store dimensions for raycasting
    controlsRef.current.glViewWidth = width;
    controlsRef.current.glViewHeight = height;

    console.log("GL Context created with dimensions:", width, height);

    // Khởi tạo renderer
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setClearColor(0xf0f7f0, 1);
    rendererRef.current = renderer;

    // Tạo scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Tạo camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 1, 3);
    cameraRef.current = camera;

    // Khởi tạo raycaster
    const raycaster = new THREE.Raycaster();
    raycasterRef.current = raycaster;

    // Thêm ánh sáng
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    let faceMesh: THREE.Object3D | null = null;

    try {
      setLoadingMessage("Đang tải model OBJ...");
      console.log("Attempting to load human.obj model...");

      const asset = Asset.fromModule(require("../assets/models/human.obj"));
      await asset.downloadAsync();

      console.log(
        "Asset downloaded successfully:",
        asset.localUri || asset.uri
      );

      const response = await fetch(asset.localUri || asset.uri);
      const objText = await response.text();

      console.log("OBJ file size:", objText.length, "characters");

      if (objText.length < 100) {
        throw new Error("OBJ file seems to be empty or corrupted");
      }

      console.log("Parsing OBJ with custom parser...");
      const geometry = parseOBJ(objText);

      const material = new THREE.MeshLambertMaterial({
        color: 0xfdbcb4,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide,
      });

      faceMesh = new THREE.Mesh(geometry, material);

      // Calculate bounding box for proper scaling
      const box = new THREE.Box3().setFromObject(faceMesh);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      faceMesh.scale.setScalar(scale);
      faceMesh.position.set(0, -box.min.y * scale, 0);

      scene.add(faceMesh);
      modelRef.current = faceMesh;
      setModelLoaded(true);
      setLoadingMessage("Model loaded!");
      console.log("Human OBJ model loaded successfully");
    } catch (error) {
      console.error("Error loading OBJ:", error);
      setLoadingMessage("Tạo model dự phòng...");

      // Create detailed fallback human with better clickable areas
      const createDetailedHuman = () => {
        const group = new THREE.Group();

        // Create clickable areas with larger geometries for better interaction
        const createClickableArea = (
          geometry: THREE.BufferGeometry,
          color: number,
          position: [number, number, number],
          bodyPart: string
        ) => {
          const material = new THREE.MeshLambertMaterial({
            color,
            transparent: true,
            opacity: 0.9,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(...position);
          mesh.userData = { bodyPart, clickable: true };
          return mesh;
        };

        // Head - larger clickable area
        const headGeometry = new THREE.SphereGeometry(0.35, 32, 32);
        const head = createClickableArea(
          headGeometry,
          0xfdbcb4,
          [0, 1.7, 0],
          "Đầu"
        );
        group.add(head);

        // Face areas
        const faceGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const forehead = createClickableArea(
          faceGeometry,
          0xfdbcb4,
          [0, 1.85, 0.25],
          "Trán"
        );
        const leftCheek = createClickableArea(
          faceGeometry,
          0xfdbcb4,
          [-0.15, 1.7, 0.25],
          "Má trái"
        );
        const rightCheek = createClickableArea(
          faceGeometry,
          0xfdbcb4,
          [0.15, 1.7, 0.25],
          "Má phải"
        );
        const chin = createClickableArea(
          faceGeometry,
          0xfdbcb4,
          [0, 1.55, 0.25],
          "Cằm"
        );

        group.add(forehead, leftCheek, rightCheek, chin);

        // Neck
        const neckGeometry = new THREE.CylinderGeometry(0.15, 0.18, 0.35, 16);
        const neck = createClickableArea(
          neckGeometry,
          0xfdbcb4,
          [0, 1.35, 0],
          "Cổ"
        );
        group.add(neck);

        // Upper torso
        const upperTorsoGeometry = new THREE.CylinderGeometry(
          0.25,
          0.32,
          0.85,
          16
        );
        const upperTorso = createClickableArea(
          upperTorsoGeometry,
          0xe6c2a6,
          [0, 0.7, 0],
          "Ngực"
        );
        group.add(upperTorso);

        // Arms with better clickable areas
        const upperArmGeometry = new THREE.CylinderGeometry(
          0.1,
          0.12,
          0.75,
          12
        );

        const leftUpperArm = createClickableArea(
          upperArmGeometry,
          0xfdbcb4,
          [-0.45, 0.8, 0],
          "Tay trái"
        );
        leftUpperArm.rotation.z = Math.PI / 8;

        const rightUpperArm = createClickableArea(
          upperArmGeometry,
          0xfdbcb4,
          [0.45, 0.8, 0],
          "Tay phải"
        );
        rightUpperArm.rotation.z = -Math.PI / 8;

        group.add(leftUpperArm, rightUpperArm);

        // Lower torso
        const lowerTorsoGeometry = new THREE.CylinderGeometry(
          0.28,
          0.25,
          0.65,
          16
        );
        const lowerTorso = createClickableArea(
          lowerTorsoGeometry,
          0xe6c2a6,
          [0, 0, 0],
          "Bụng"
        );
        group.add(lowerTorso);

        // Legs
        const thighGeometry = new THREE.CylinderGeometry(0.12, 0.14, 0.85, 12);

        const leftThigh = createClickableArea(
          thighGeometry,
          0xfdbcb4,
          [-0.15, -1.1, 0],
          "Chân trái"
        );
        const rightThigh = createClickableArea(
          thighGeometry,
          0xfdbcb4,
          [0.15, -1.1, 0],
          "Chân phải"
        );

        group.add(leftThigh, rightThigh);

        return group;
      };

      faceMesh = createDetailedHuman();
      faceMesh.scale.setScalar(0.6);
      faceMesh.position.set(0, 1.2, 0);

      scene.add(faceMesh);
      modelRef.current = faceMesh;
      setModelLoaded(true);
      setLoadingMessage("Model dự phòng đã sẵn sàng");
    }

    // Create improved selection marker with better visibility
    const createSelectionMarker = () => {
      const markerGroup = new THREE.Group();

      // Main marker sphere - làm to hơn và màu sắc nổi bật
      const markerGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: false,
        opacity: 1.0,
        depthTest: false, // Luôn hiển thị trên cùng
      });
      const markerSphere = new THREE.Mesh(markerGeometry, markerMaterial);
      markerGroup.add(markerSphere);

      // Outer ring for better visibility - màu vàng nổi bật
      const ringGeometry = new THREE.RingGeometry(0.18, 0.22, 16);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      markerGroup.add(ring);

      // Animated pulse ring - màu xanh lá
      const pulseRingGeometry = new THREE.RingGeometry(0.25, 0.3, 16);
      const pulseRingMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const pulseRing = new THREE.Mesh(pulseRingGeometry, pulseRingMaterial);
      markerGroup.add(pulseRing);

      markerGroup.visible = false;
      markerGroup.renderOrder = 999; // Render sau cùng

      console.log(
        "Selection marker created with",
        markerGroup.children.length,
        "children"
      );
      return markerGroup;
    };

    const marker = createSelectionMarker();
    scene.add(marker);
    selectedMarkerRef.current = marker;

    // Update camera function
    const updateCamera = () => {
      if (!cameraRef.current) return;

      const controls = controlsRef.current;
      const camera = cameraRef.current;

      const radius = controls.zoom;
      const x =
        radius * Math.sin(controls.rotationX) * Math.cos(controls.rotationY);
      const y = radius * Math.cos(controls.rotationX) + 1;
      const z =
        radius * Math.sin(controls.rotationX) * Math.sin(controls.rotationY);

      camera.position.set(x + controls.positionX, y + controls.positionY, z);
      camera.lookAt(controls.positionX, 1 + controls.positionY, 0);
    };

    // Animation for pulse effect - cải thiện animation
    let pulseDirection = 1;
    const animateMarker = () => {
      if (selectedMarkerRef.current && selectedMarkerRef.current.visible) {
        const pulseRing = selectedMarkerRef.current.children[2];
        if (pulseRing && pulseRing.material) {
          const material = pulseRing.material as THREE.MeshBasicMaterial;
          material.opacity += pulseDirection * 0.03;

          if (material.opacity >= 0.9) {
            pulseDirection = -1;
          } else if (material.opacity <= 0.3) {
            pulseDirection = 1;
          }
        }

        // Thêm rotation animation cho ring
        const ring = selectedMarkerRef.current.children[1];
        if (ring) {
          ring.rotation.z += 0.02;
        }
      }
    };

    // Render loop
    const render = () => {
      requestAnimationFrame(render);
      updateCamera();
      animateMarker();

      // Đảm bảo renderer clear depth buffer
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    // Start render loop after a small delay
    setTimeout(() => {
      render();
    }, 100);
  };

  const performRaycast = (x: number, y: number) => {
    if (
      !modelRef.current ||
      !cameraRef.current ||
      !raycasterRef.current ||
      !sceneRef.current
    ) {
      console.log("Missing required objects for raycasting");
      return;
    }

    const controls = controlsRef.current;

    // Convert screen coordinates to normalized device coordinates
    const mouse = new THREE.Vector2();
    mouse.x = (x / controls.glViewWidth) * 2 - 1;
    mouse.y = -(y / controls.glViewHeight) * 2 + 1;

    console.log("Screen coords:", x, y);
    console.log("Normalized coords:", mouse.x, mouse.y);
    console.log(
      "GLView dimensions:",
      controls.glViewWidth,
      controls.glViewHeight
    );

    // Cast ray from camera through mouse position
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);

    // Find intersections with all objects in the scene recursively
    const allObjects: THREE.Object3D[] = [];
    sceneRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child !== selectedMarkerRef.current) {
        allObjects.push(child);
      }
    });

    console.log("Objects to intersect with:", allObjects.length);

    // Try intersecting with all mesh objects
    const intersects = raycasterRef.current.intersectObjects(allObjects, true);

    console.log("Intersections found:", intersects.length);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const point = intersect.point;

      console.log("Intersection point:", point);
      console.log("Intersected object:", intersect.object);

      // Position marker với offset lớn hơn về phía camera
      if (selectedMarkerRef.current) {
        const offset = new THREE.Vector3();

        // Tính toán vector từ điểm giao cắt đến camera
        const cameraPosition = cameraRef.current.position;
        offset.subVectors(cameraPosition, point).normalize();
        offset.multiplyScalar(0.3); // Tăng offset để marker rõ ràng hơn

        const markerPosition = new THREE.Vector3();
        markerPosition.copy(point).add(offset);

        selectedMarkerRef.current.position.copy(markerPosition);
        selectedMarkerRef.current.visible = true;

        // Force update marker scale để đảm bảo nó đủ lớn
        selectedMarkerRef.current.scale.setScalar(1.5);

        // Orient ring to face camera
        selectedMarkerRef.current.lookAt(cameraRef.current.position);

        console.log("Marker positioned at:", markerPosition);
        console.log("Marker visible:", selectedMarkerRef.current.visible);
        console.log("Marker scale:", selectedMarkerRef.current.scale);

        // Force render để update ngay lập tức
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }

      // Determine body area
      let bodyPart = "Không xác định";

      if (intersect.object.userData && intersect.object.userData.bodyPart) {
        bodyPart = intersect.object.userData.bodyPart;
      } else {
        const { x: px, y: py, z: pz } = point;
        console.log("Point coordinates for area detection:", px, py, pz);

        if (py > 1.4) {
          // Head and face region
          if (py > 1.8 && pz > 0.1) {
            bodyPart = "Trán";
          } else if (py > 1.6 && py <= 1.8) {
            if (px < -0.1) {
              bodyPart = "Má trái";
            } else if (px > 0.1) {
              bodyPart = "Má phải";
            } else {
              bodyPart = "Mũi";
            }
          } else if (py > 1.5 && py <= 1.6) {
            bodyPart = "Cằm";
          } else {
            bodyPart = "Cổ";
          }
        } else if (py > 0.3) {
          // Upper body region
          if (Math.abs(px) > 0.3) {
            bodyPart = px < 0 ? "Tay trái" : "Tay phải";
          } else {
            if (py > 0.7) {
              bodyPart = "Ngực";
            } else {
              bodyPart = "Lưng";
            }
          }
        } else if (py > -0.5) {
          // Mid body region
          bodyPart = "Bụng";
        } else {
          // Lower body region
          if (Math.abs(px) > 0.1) {
            bodyPart = px < 0 ? "Chân trái" : "Chân phải";
          } else {
            bodyPart = "Chân";
          }
        }
      }

      const selectedPoint = {
        x: point.x,
        y: point.y,
        z: point.z,
        area: bodyPart,
      };

      setSelectedPoint(selectedPoint);
      onPointSelected(selectedPoint);
    } else {
      // Hide marker when no intersection found
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.visible = false;
        console.log("No intersection - marker hidden");
      }

      setSelectedPoint(null);
    }
  };

  // Improved touch handling
  const handleTouch = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const controls = controlsRef.current;

    // Only perform raycast if not dragging
    if (
      !controls.isDragging &&
      controls.totalDragDistance < controls.dragThreshold
    ) {
      console.log("Touch detected at:", locationX, locationY);
      console.log(
        "GLView dimensions:",
        controls.glViewWidth,
        controls.glViewHeight
      );

      // Small delay to ensure dragging state is properly set
      setTimeout(() => {
        if (!controls.isDragging) {
          performRaycast(locationX, locationY);
        }
      }, 10);
    } else {
      console.log("Touch ignored - dragging detected", {
        isDragging: controls.isDragging,
        dragDistance: controls.totalDragDistance,
        threshold: controls.dragThreshold,
      });
    }
  };

  // Improved pinch handler
  const handlePinch = (event: PinchGestureHandlerGestureEvent) => {
    const { state, scale } = event.nativeEvent;
    const controls = controlsRef.current;

    if (state === State.BEGAN) {
      controls.lastPinchScale = scale;
      controls.isDragging = true;
    } else if (state === State.ACTIVE) {
      const scaleFactor = scale / controls.lastPinchScale;
      controls.zoom = Math.max(1.5, Math.min(8, controls.zoom / scaleFactor));
      controls.lastPinchScale = scale;
    } else if (state === State.END || state === State.CANCELLED) {
      controls.lastPinchScale = 1;
      setTimeout(() => {
        controls.isDragging = false;
      }, 50);
    }
  };

  // Improved pan handler with better drag detection
  const handlePan = (event: PanGestureHandlerGestureEvent) => {
    const { state, translationX, translationY } = event.nativeEvent;
    const controls = controlsRef.current;

    if (state === State.BEGAN) {
      controls.baseRotationX = controls.rotationX;
      controls.baseRotationY = controls.rotationY;
      controls.totalDragDistance = 0;
      controls.isDragging = true;
      console.log("Pan began - dragging enabled");
    } else if (state === State.ACTIVE) {
      const dragDistance = Math.sqrt(
        translationX * translationX + translationY * translationY
      );
      controls.totalDragDistance = dragDistance;

      // Apply rotation with improved sensitivity
      const sensitivity = 0.006;
      controls.rotationY = controls.baseRotationY + translationX * sensitivity;
      controls.rotationX = controls.baseRotationX - translationY * sensitivity;

      // Clamp rotation
      controls.rotationX = Math.max(
        0.1,
        Math.min(Math.PI - 0.1, controls.rotationX)
      );
    } else if (state === State.END || state === State.CANCELLED) {
      console.log("Pan ended");
      // Reset dragging state after short delay
      setTimeout(() => {
        controls.isDragging = false;
        controls.totalDragDistance = 0;
      }, 50);
    }
  };

  const resetView = () => {
    const controls = controlsRef.current;
    controls.zoom = 3;
    controls.rotationX = Math.PI / 2;
    controls.rotationY = 0;
    controls.baseRotationX = Math.PI / 2;
    controls.baseRotationY = 0;
    controls.positionX = 0;
    controls.positionY = 0;
    controls.lastPinchScale = 1;
    controls.isDragging = false;
    controls.totalDragDistance = 0;
  };

  const clearSelection = () => {
    setSelectedPoint(null);
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.visible = false;
    }
  };

  const testMarker = () => {
    if (selectedMarkerRef.current && modelRef.current) {
      console.log("Testing marker visibility...");

      // Force hiển thị marker ở vị trí dễ thấy
      selectedMarkerRef.current.position.set(0, 2, 1);
      selectedMarkerRef.current.visible = true;
      selectedMarkerRef.current.scale.setScalar(2); // Làm to marker để dễ thấy

      // Đảm bảo tất cả children đều visible
      selectedMarkerRef.current.children.forEach((child, index) => {
        child.visible = true;
        console.log(`Child ${index} visible:`, child.visible);
      });

      setSelectedPoint({
        x: 0,
        y: 2,
        z: 1,
        area: "Test Area",
      });

      console.log(
        "Test marker - Position:",
        selectedMarkerRef.current.position
      );
      console.log("Test marker - Visible:", selectedMarkerRef.current.visible);
      console.log("Test marker - Scale:", selectedMarkerRef.current.scale);

      // Force render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }
  };

  return (
    <View style={styles.container}>
      <GestureHandlerRootView style={styles.gestureContainer}>
        <PanGestureHandler
          ref={panRef}
          onGestureEvent={handlePan}
          minPointers={1}
          maxPointers={1}
          shouldCancelWhenOutside={false}
          minDist={5} // Reduced minimum distance
        >
          <PinchGestureHandler
            ref={pinchRef}
            onGestureEvent={handlePinch}
            simultaneousHandlers={[panRef]}
          >
            <GLView
              ref={glViewRef}
              style={styles.glView}
              onContextCreate={onContextCreate}
              onTouchStart={(event) => {
                const controls = controlsRef.current;
                controls.totalDragDistance = 0;
                controls.isDragging = false;
              }}
              onTouchEnd={handleTouch}
            />
          </PinchGestureHandler>
        </PanGestureHandler>
      </GestureHandlerRootView>

      {!modelLoaded && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </View>
      )}

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Kéo để xoay • Pinch để zoom • Chạm để chọn
        </Text>
        <Text style={styles.subInstructionText}>
          Chạm vào model để chọn vùng da cần kiểm tra
        </Text>
        {selectedPoint && (
          <Text style={styles.selectedText}>Đã chọn: {selectedPoint.area}</Text>
        )}
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.resetButton} onPress={resetView}>
          <Text style={styles.resetButtonText}>Reset View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetButton} onPress={testMarker}>
          <Text style={styles.resetButtonText}>Test Marker</Text>
        </TouchableOpacity>
        {selectedPoint && (
          <TouchableOpacity style={styles.clearButton} onPress={clearSelection}>
            <Text style={styles.clearButtonText}>Xóa chọn</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 400,
    backgroundColor: "#f0f7f0",
    borderRadius: 16,
    overflow: "hidden",
  },
  gestureContainer: {
    flex: 1,
  },
  glView: {
    flex: 1,
  },
  instructions: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 8,
    borderRadius: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  instructionText: {
    fontSize: 14,
    color: "#00A86B",
    textAlign: "center",
    fontWeight: "600",
  },
  subInstructionText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 2,
  },
  selectedText: {
    fontSize: 14,
    color: "#00A86B",
    textAlign: "center",
    marginTop: 6,
    fontWeight: "700",
    backgroundColor: "#e8f5e8",
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#00A86B",
  },
  loadingOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    transform: [{ translateX: -50 }, { translateY: -25 }],
    padding: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    fontSize: 16,
    color: "#00A86B",
    fontWeight: "600",
    textAlign: "center",
  },
  controlsContainer: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "column",
    gap: 8,
  },
  resetButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "#ff6b6b",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
