import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { collection, addDoc, updateDoc, arrayUnion, doc } from 'firebase/firestore';
import { auth, db } from '../constants/firebase-config';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import designSystem from '../theme/designSystem';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPACING = 20;
const NORMALIZE = (s: number) => Math.round((SCREEN_WIDTH / 375) * s);

const categories = ['Santé','Fitness','Finance','Mode de Vie','Éducation','Créativité','Carrière','Social','Productivité','Écologie','Motivation','Développement Personnel','Discipline',"État d'esprit",'Autres'];

export default function CreateChallenge() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const colors = isDark ? designSystem.darkTheme.colors : designSystem.lightTheme.colors;
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') alert(t('permissionDenied'));
    })();
  }, []);

  const pickImage = useCallback(async () => {
    await Haptics.selectionAsync();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }, []);

  const removeImage = () => {
    setImageUri(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('not_logged');
      const chatId = title.trim().toLowerCase().replace(/\s+/g, '_');
      const data = {
        title: title.trim(),
        description: description.trim(),
        category,
        daysOptions: [7,15,21,30,60,90,180,365],
        imageUrl: imageUri || '',
        participantsCount: 0,
        createdAt: new Date(),
        creatorId: user.uid,
        chatId,
        usersTakingChallenge: [],
        approved: false,
      };
      const ref = await addDoc(collection(db, 'challenges'), data);
      await updateDoc(doc(db, 'users', user.uid), {
        createdChallenges: arrayUnion({ id: ref.id, ...data }),
      });
      router.push('/explore');
    } catch (e) {
      console.error(e);
      alert(t('challengeCreateFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [title, description, category, imageUri]);

  const valid = !!title.trim() && !!description.trim();

  return (
    <LinearGradient colors={[colors.background, colors.cardBackground]} style={styles.wrapper}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={NORMALIZE(24)} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('createYourChallenge')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {[{
          label: t('challengeTitle'),
          value: title,
          setter: setTitle,
          multiline: false,
          placeholder: t('challengeTitle'),
        }, {
          label: t('challengeDescription'),
          value: description,
          setter: setDescription,
          multiline: true,
          placeholder: t('challengeDescription'),
        }].map((field, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{field.label}</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textSecondary}
              value={field.value}
              onChangeText={field.setter}
              multiline={field.multiline}
            />
          </View>
        ))}

        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('category')}</Text>
          <View style={[styles.pickerWrap, { borderColor: colors.border }]}>
            <Picker selectedValue={category} onValueChange={v => setCategory(v)} style={{ color: colors.textPrimary }}>
              {categories.map(c => <Picker.Item key={c} label={c} value={c} />)}
            </Picker>
          </View>
        </View>

        <TouchableOpacity style={[styles.imageBtn, { borderColor: colors.border }]} onPress={pickImage}>
          {imageUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.image} />
              <TouchableOpacity style={styles.removeIcon} onPress={removeImage}>
                <Ionicons name="close-circle" size={NORMALIZE(24)} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.upload, { color: colors.primary }]}>{t('uploadImageOptional')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.buttons}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.secondary }]} disabled={!valid || submitting} onPress={() => setPreviewVisible(true)}>
            <Text style={styles.btnText}>{t('preview')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: valid ? colors.primary : colors.border }]} disabled={!valid || submitting} onPress={handleSubmit}>
            <Text style={styles.btnText}>{submitting ? t('submitting') : t('create')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('preview')}</Text>
            <ScrollView>
              <Text style={[styles.modalText, { color: colors.textPrimary }]}>{title}</Text>
              <Text style={[styles.modalText, { color: colors.textSecondary }]}>{description}</Text>
              <Text style={[styles.modalText, { color: colors.textSecondary }]}>{t('category')}: {category}</Text>
              {imageUri && <Image source={{ uri: imageUri }} style={styles.modalImage} />}
            </ScrollView>
            <TouchableOpacity style={{ marginTop: SPACING/2 }} onPress={() => setPreviewVisible(false)}>
              <Text style={[styles.close, { color: colors.primary }]}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : SPACING },
  backBtn: { padding: SPACING/2 },
  title: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: NORMALIZE(20), fontWeight: '700' },
  content: { padding: SPACING, paddingBottom: SPACING*2 },
  card: { borderRadius: 12, padding: SPACING, marginBottom: SPACING, shadowColor: '#000', shadowOffset: {width:0,height:4}, shadowOpacity:0.05, shadowRadius:6, elevation:3 },
  label: { fontSize: NORMALIZE(13), marginBottom: SPACING/2, textTransform: 'uppercase', fontWeight: '600' },
  input: { fontSize: NORMALIZE(16), minHeight: NORMALIZE(40) },
  textArea: { minHeight: NORMALIZE(80) },
  pickerWrap: { borderWidth: 1, borderRadius: 8 },
  imageBtn: { borderWidth: 1.2, borderRadius: 12, padding: SPACING, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING },
  upload: { fontSize: NORMALIZE(14), fontWeight: '500' },
  imageContainer: { width: '100%', height: NORMALIZE(170), borderRadius: 10, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  removeIcon: { position:'absolute', top:8, right:8 },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING },
  btn: { flex:1, padding: SPACING*0.8, borderRadius: 24, alignItems: 'center', marginHorizontal: SPACING/4 },
  btnText: { color: '#FFF', fontSize: NORMALIZE(15), fontWeight: '600' },
  modalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:SPACING },
  modalCard:{ width:'90%', maxHeight:'80%', borderRadius:16, padding:SPACING, shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.1, shadowRadius:8, elevation:5 },
  modalTitle:{ fontSize: NORMALIZE(18), fontWeight:'700', marginBottom:SPACING, textAlign:'center' },
  modalText:{ fontSize: NORMALIZE(15), marginBottom: SPACING/2 },
  modalImage:{ width:'100%', height: NORMALIZE(120), borderRadius:10, marginVertical: SPACING/2 },
  close:{ fontSize: NORMALIZE(15), fontWeight:'600', textAlign:'center' },
});
