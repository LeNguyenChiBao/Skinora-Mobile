import {
  authService,
  UpdateUserRequest,
  User,
} from "@/services/authServices.service";
import { userService } from "@/services/user.service";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Appointment {
  _id: string;
  userId: string;
  doctorId: {
    _id: string;
    email: string;
    fullName: string;
    photoUrl: string;
  };
  startTime: string;
  endTime: string;
  appointmentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UpdateUserRequest>({});
  const [updating, setUpdating] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [showAppointments, setShowAppointments] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await authService.getUserData();
        console.log("getUserData response:", userData);
        setUser(userData);
        if (userData) {
          setEditData({
            fullName: userData.fullName,
            phone: userData.phone,
            address: userData.address,
            avatarUrl: userData.avatarUrl,
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const fetchAppointments = async () => {
    if (!user?.id) return;

    try {
      setLoadingAppointments(true);
      const response = await userService.getUserAppointments(user.id);

      if (response.success) {
        setAppointments(response.data);
        setShowAppointments(true);
      } else {
        Alert.alert("Lỗi", "Không thể tải lịch hẹn");
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ");
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      setUpdating(true);
      const result = await authService.updateUser(user.id, editData);

      if (result.success && result.data) {
        setUser(result.data.user);
        setIsEditing(false);
        Alert.alert("Thành công", "Cập nhật thông tin thành công!");
      } else {
        Alert.alert("Lỗi", result.message || "Cập nhật thông tin thất bại");
      }
    } catch (error) {
      console.error("Update profile error:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra khi cập nhật thông tin");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setEditData({
        fullName: user.fullName,
        phone: user.phone,
        address: user.address,
        avatarUrl: user.avatarUrl,
      });
    }
    setIsEditing(false);
  };

  const handleLogout = async () => {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          try {
            await authService.logout();
            router.replace("/welcome");
          } catch (error) {
            console.error("Logout error:", error);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00A86B" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  const formatAppointmentTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    const date = start.toLocaleDateString("vi-VN");
    const timeStart = start.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const timeEnd = end.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return { date, time: `${timeStart} - ${timeEnd}` };
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return "#4285F4";
      case "completed":
        return "#00A86B";
      case "cancelled":
        return "#dc3545";
      default:
        return "#666666";
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return "Đã đặt";
      case "completed":
        return "Hoàn thành";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user ? getInitials(user.fullName) : "U"}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.fullName || "Người dùng"}</Text>
        <Text style={styles.userRole}>{user?.role || "Khách hàng"}</Text>
      </View>

      {user ? (
        <>
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Thông tin cá nhân</Text>
              {!isEditing ? (
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Chỉnh sửa</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={handleCancelEdit}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveProfile}
                    style={styles.saveButton}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Lưu</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{user.email}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Họ tên:</Text>
              {isEditing ? (
                <TextInput
                  style={styles.editInput}
                  value={editData.fullName}
                  onChangeText={(text) =>
                    setEditData({ ...editData, fullName: text })
                  }
                  placeholder="Nhập họ tên"
                />
              ) : (
                <Text style={styles.value}>{user.fullName}</Text>
              )}
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Số điện thoại:</Text>
              {isEditing ? (
                <TextInput
                  style={styles.editInput}
                  value={editData.phone}
                  onChangeText={(text) =>
                    setEditData({ ...editData, phone: text })
                  }
                  placeholder="Nhập số điện thoại"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.value}>{user.phone}</Text>
              )}
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Địa chỉ:</Text>
              {isEditing ? (
                <TextInput
                  style={styles.editInput}
                  value={editData.address}
                  onChangeText={(text) =>
                    setEditData({ ...editData, address: text })
                  }
                  placeholder="Nhập địa chỉ"
                  multiline
                />
              ) : (
                <Text style={styles.value}>{user.address}</Text>
              )}
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Ngày sinh:</Text>
              <Text style={styles.value}>
                {new Date(user.dob).toLocaleDateString("vi-VN")}
              </Text>
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.cardTitle}>Trạng thái tài khoản</Text>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Tình trạng:</Text>
              <Text
                style={[
                  styles.value,
                  user.isActive ? styles.activeText : styles.inactiveText,
                ]}
              >
                {user.isActive ? "Đang hoạt động" : "Không hoạt động"}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Xác thực:</Text>
              <Text
                style={[
                  styles.value,
                  user.isVerified ? styles.verifiedText : styles.unverifiedText,
                ]}
              >
                {user.isVerified ? "Đã xác thực" : "Chưa xác thực"}
              </Text>
            </View>
          </View>

          {!isEditing && (
            <View style={styles.actionCard}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push("/(stacks)/my-appointments")}
              >
                <View style={styles.actionButtonContent}>
                  <Ionicons name="calendar-outline" size={20} color="#00A86B" />
                  <Text style={styles.actionText}>Lịch hẹn của tôi</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <View style={styles.actionButtonContent}>
                  <Ionicons name="key-outline" size={20} color="#00A86B" />
                  <Text style={styles.actionText}>Đổi mật khẩu</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <View style={styles.actionButtonContent}>
                  <Ionicons name="settings-outline" size={20} color="#00A86B" />
                  <Text style={styles.actionText}>Cài đặt</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Appointments Section */}
          {showAppointments && (
            <View style={styles.appointmentsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Lịch hẹn của tôi ({appointments.length})
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAppointments(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {appointments.length === 0 ? (
                <View style={styles.emptyAppointments}>
                  <Ionicons name="calendar-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>Chưa có lịch hẹn nào</Text>
                </View>
              ) : (
                appointments.map((appointment) => {
                  const { date, time } = formatAppointmentTime(
                    appointment.startTime,
                    appointment.endTime
                  );
                  return (
                    <View key={appointment._id} style={styles.appointmentItem}>
                      <View style={styles.appointmentHeader}>
                        <View style={styles.doctorInfo}>
                          <Image
                            source={{
                              uri:
                                appointment.doctorId.photoUrl ||
                                "https://via.placeholder.com/40",
                            }}
                            style={styles.doctorAvatar}
                          />
                          <View style={styles.doctorDetails}>
                            <Text style={styles.doctorName}>
                              {appointment.doctorId.fullName}
                            </Text>
                            <Text style={styles.appointmentDate}>{date}</Text>
                            <Text style={styles.appointmentTime}>{time}</Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor:
                                getStatusColor(appointment.appointmentStatus) +
                                "20",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              {
                                color: getStatusColor(
                                  appointment.appointmentStatus
                                ),
                              },
                            ]}
                          >
                            {getStatusText(appointment.appointmentStatus)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </>
      ) : (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            Không thể tải thông tin người dùng
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
    marginBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F5E8",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#00A86B",
  },
  header: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#00A86B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 2,
    borderColor: "#E8F5E8",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00A86B",
    marginBottom: 5,
  },
  userRole: {
    fontSize: 16,
    color: "#666666",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    margin: 15,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    margin: 15,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    margin: 15,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00A86B",
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E8F5E8",
  },
  label: {
    fontSize: 16,
    color: "#666666",
    flex: 1,
  },
  value: {
    fontSize: 16,
    color: "#333333",
    flex: 1,
    textAlign: "right",
  },
  activeText: {
    color: "#00A86B",
    fontWeight: "600",
  },
  inactiveText: {
    color: "#dc3545",
    fontWeight: "600",
  },
  verifiedText: {
    color: "#00A86B",
    fontWeight: "600",
  },
  unverifiedText: {
    color: "#ffc107",
    fontWeight: "600",
  },
  actionButton: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8F5E8",
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    color: "#00A86B",
    fontWeight: "500",
  },
  errorCard: {
    backgroundColor: "#FFFFFF",
    margin: 15,
    padding: 30,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  errorText: {
    fontSize: 16,
    color: "#dc3545",
    textAlign: "center",
  },
  logoutButton: {
    backgroundColor: "#dc3545",
    margin: 15,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 30,
    shadowColor: "#dc3545",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  editButton: {
    backgroundColor: "#00A86B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#dc3545",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#00A86B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 50,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  editInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 16,
    color: "#333333",
    borderBottomWidth: 1,
    borderBottomColor: "#00A86B",
    paddingVertical: 4,
  },
  closeButton: {
    padding: 4,
  },
  appointmentsCard: {
    backgroundColor: "#FFFFFF",
    margin: 15,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyAppointments: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  appointmentItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#E8F5E8",
    paddingVertical: 16,
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  doctorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  doctorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: "#E0E0E0",
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  appointmentDate: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  appointmentTime: {
    fontSize: 14,
    color: "#00A86B",
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
