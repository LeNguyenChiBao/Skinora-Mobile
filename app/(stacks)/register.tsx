import { addressService } from "@/services/addressService.service";
import { authService } from "@/services/authServices.service";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Add options to hide header
export const options = {
  headerShown: false,
};

interface Province {
  code: string;
  name: string;
  englishName: string;
  administrativeLevel: string;
  decree: string;
}

interface Commune {
  code: string;
  name: string;
  englishName: string;
  administrativeLevel: string;
  provinceCode: string;
  provinceName: string;
  decree: string;
}

export default function RegisterScreen() {
  const router = useRouter();

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingCommunes, setIsLoadingCommunes] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    dob: "",
    streetAddress: "",
    province: "",
    city: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);

  // Load provinces on component mount
  useEffect(() => {
    loadProvinces();
  }, []);

  // Load communes when province changes
  useEffect(() => {
    if (form.province) {
      loadCommunes(form.province);
    } else {
      setCommunes([]);
    }
  }, [form.province]);

  const loadProvinces = async () => {
    setIsLoadingProvinces(true);
    try {
      const provincesData = await addressService.getProvinces();
      console.log("Provinces API Response:", provincesData);
      
      // Check if the response is an object with a data property
      let provincesArray: Province[] = [];
      if (Array.isArray(provincesData)) {
        provincesArray = provincesData;
      } else if (provincesData && provincesData.data && Array.isArray(provincesData.data)) {
        provincesArray = provincesData.data;
      } else if (provincesData && provincesData.provinces && Array.isArray(provincesData.provinces)) {
        provincesArray = provincesData.provinces;
      } else if (provincesData && provincesData.results && Array.isArray(provincesData.results)) {
        provincesArray = provincesData.results;
      }
      
      // Filter out invalid entries (empty code or "Số lượng" entries)
      const validProvinces = provincesArray.filter(
        (province) => province.code && province.code.trim() !== "" && 
        !province.name.includes("Số lượng")
      );
      
      console.log("Processed provinces array:", validProvinces);
      setProvinces(validProvinces);
    } catch (error) {
      console.error("Error loading provinces:", error);
      Alert.alert(
        "Lỗi",
        "Không thể tải danh sách tỉnh/thành phố. Vui lòng thử lại."
      );
    } finally {
      setIsLoadingProvinces(false);
    }
  };

  const loadCommunes = async (provinceCode: string) => {
    setIsLoadingCommunes(true);
    try {
      const communesData = await addressService.getCommunesByProvince(provinceCode);      

      let communesArray: Commune[] = [];
      if (Array.isArray(communesData)) {
        communesArray = communesData;
      } else if (communesData && communesData.data && Array.isArray(communesData.data)) {
        communesArray = communesData.data;
      } else if (communesData && communesData.communes && Array.isArray(communesData.communes)) {
        communesArray = communesData.communes;
      } else if (communesData && communesData.results && Array.isArray(communesData.results)) {
        communesArray = communesData.results;
      }
      
      // Filter out invalid entries (empty code or "Số lượng" entries)
      const validCommunes = communesArray.filter(
        (commune) => commune.code && commune.code.trim() !== "" && 
        !commune.name.includes("Số lượng")
      );
      
      setCommunes(validCommunes);
    } catch (error) {
      console.error("Error loading communes:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách quận/huyện. Vui lòng thử lại.");
    } finally {
      setIsLoadingCommunes(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "province") {
      setForm((prev) => ({ ...prev, city: "" }));
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      // Format as YYYY-MM-DD
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const dd = String(selectedDate.getDate()).padStart(2, "0");
      handleChange("dob", `${yyyy}-${mm}-${dd}`);
    }
  };

  const handleRegister = async () => {
    // Basic validation
    if (
      !form.email ||
      !form.password ||
      !form.fullName ||
      !form.phone ||
      !form.dob ||
      !form.streetAddress ||
      !form.province ||
      !form.city
    ) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setIsLoading(true);
    try {
      // Find selected province and commune names
      const selectedProvince = provinces.find((p) => p.code === form.province);
      const selectedCommune = communes.find((c) => c.code === form.city);

      // Combine address parts into a single string
      const fullAddress = `${form.streetAddress}, ${selectedCommune?.name}, ${selectedProvince?.name}`;

      const response = await authService.register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        dob: form.dob,
        address: fullAddress,
        avatarUrl: "https://example.com/jane-avatar.jpg",
      });
      if (response.success) {
        Alert.alert("Thành công", "Đăng ký thành công. Vui lòng đăng nhập.");
        router.replace("/(stacks)/login");
      } else {
        const errorMessage = Array.isArray(response.message)
          ? response.message.join("\n") // Join errors with a newline
          : response.message || "Đăng ký thất bại";
        Alert.alert("Lỗi", errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Có lỗi xảy ra. Vui lòng thử lại.";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8F5E8" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Đăng ký tài khoản</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập email"
              value={form.email}
              onChangeText={(v) => handleChange("email", v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Mật khẩu</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              value={form.password}
              onChangeText={(v) => handleChange("password", v)}
              secureTextEntry
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Họ và tên</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập họ và tên"
              value={form.fullName}
              onChangeText={(v) => handleChange("fullName", v)}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập số điện thoại"
              value={form.phone}
              onChangeText={(v) => handleChange("phone", v)}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Ngày sinh</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={{ color: form.dob ? "#222" : "#999" }}>
                {form.dob ? form.dob : "Chọn ngày sinh"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Tỉnh/Thành phố</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={form.province}
                onValueChange={(v: string) => handleChange("province", v)}
                style={styles.picker}
                enabled={!isLoadingProvinces}
              >
                <Picker.Item
                  label={isLoadingProvinces ? "Đang tải..." : "Chọn tỉnh/thành phố"}
                  value=""
                />
                {provinces.map((p) => (
                  <Picker.Item key={p.code} label={p.name} value={p.code} />
                ))}
              </Picker>
              {isLoadingProvinces && (
                <ActivityIndicator
                  size="small"
                  color="#00A86L"
                  style={styles.loadingIndicator}
                />
              )}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Quận/Huyện/Phường/Xã</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={form.city}
                onValueChange={(v: string) => handleChange("city", v)}
                style={styles.picker}
                enabled={!!form.province && !isLoadingCommunes}
              >
                <Picker.Item
                  label={
                    isLoadingCommunes
                      ? "Đang tải..."
                      : !form.province
                      ? "Chọn tỉnh/thành phố trước"
                      : "Chọn quận/huyện/phường/xã"
                  }
                  value=""
                />
                {communes.map((c) => (
                  <Picker.Item key={c.code} label={c.name} value={c.code} />
                ))}
              </Picker>
              {isLoadingCommunes && (
                <ActivityIndicator
                  size="small"
                  color="#00A86L"
                  style={styles.loadingIndicator}
                />
              )}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Số nhà, tên đường</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập số nhà, tên đường"
              value={form.streetAddress}
              onChangeText={(v) => handleChange("streetAddress", v)}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.registerButton,
              isLoading && styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.registerButtonText}>Đăng ký</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.replace("/(stacks)/login")}>
              <Text style={styles.loginLink}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
    marginBottom: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 30,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00A86B",
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00A86B",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  registerButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  registerButtonDisabled: {
    backgroundColor: "#A0C4A7",
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  loginText: {
    color: "#666666",
    fontSize: 14,
  },
  loginLink: {
    color: "#26D0CE",
    fontSize: 14,
    fontWeight: "600",
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
    position: "relative",
  },
  picker: {
    width: "100%",
    color: "#222",
  },
  loadingIndicator: {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: [{ translateY: -10 }],
  },
});
