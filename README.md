# HUDOOR Sync & Restore

أنت الآن الخبير البرمجي والمستشار التقني لتطبيق "HUDOOR". 

أريدك أن تتحدث وتتحاور معي باللغة العربية بالكامل في جميع الردود والاستفسارات.

لدينا مشكلات جوهرية في الكود الحالي لتطبيق HUDOOR، والمطلوب منك إما إجراء صيانة شاملة وإصلاح كافة الأخطاء (Bug Fixes & Maintenance)، أو تحديد أسباب المشاكل بدقة، أو حتى إعادة بناء كود جديد كلياً وبنية برمجية نظيفة (Clean Code) تحتوي على جميع خصائص ومميزات التطبيق الحالي ولكن بدون هذه العيوب.

### 📌 معلومات تقنية أساسية:

- التطبيق مرتبط بقاعدة بيانات **Firebase** (Realtime Database / Firestore / Authentication).

---

### 🚨 المشكلات الحالية المطلوبة معالجتها فوراً:

1. **مشكلة مزامنة البيانات اللحظية (Real-time Syncing Issues):**

   - عند تسجيل حضور أو إجراء أي تعديل على جهاز معين، لا تظهر التغييرات فوراً على الأجهزة الأخرى المربوطة بنفس الحساب أو القاعدة.

   - **المطلوب:** إمكانية المزامنة اللحظية (Real-time Listeners) مع Firebase حتى ينعكس أي تغيير فوراً على كافة الأجهزة.

2. **مشكلة استرجاع الحالة وفقدان البيانات (State Persistence & Reset Bug):**

   - عند ترك التطبيق لفترة وإعادة فتحه، يعود التطبيق تلقائياً للرقم السجل القديم (849) وتختفي كافة الأسماء والتسجيلات الجديدة التي تم إضافتها.

   - **المطلوب:** معالجة إدارة الحالة (State Management) والـ Cache، وتأكيد رفع واسترجاع البيانات بشكل مستقر من Firebase للحد من مشاكل البيانات المخزنة محلياً الخاطئة.

3. **مشكلة التصفح/الإنزلاق (Scroll Freeze):**

   - خاصية الـ Scroll متوقفة تماماً ولا تعمل على جميع الأجهزة عند استعراض قائمة الأسماء أو الحضور.

   - **المطلوب:** إصلاح تنسيقات الـ CSS/Layout وخيارات الـ Overflow والمكونات البرمجية لتصبح القوائم قابلة للسكرول بسلاسة على كافة الشاشات والأجهزة.

---

### 🎯 مطلوب منك الآن:

1. قم بفحص الكود الحالي بالكامل وتحديد مكامن الخلل والأسباب التقنية لهذه المشاكل بالتفصيل.

2. إذا كان الكود الحالي قابلاً للإصلاح والتحسين، قم بإصلاح جميع الأخطاء فوراً وزودني بالتعديلات.

3. إذا كان الكود الحالي متهالكاً أو يحتوي على بنية خاطئة، اقترح عليّ إعادة بناء (Refactoring / Rebuilding) كود جديد متكامل مع الحفاظ على كافة الفكرة والمميزات السابقة وبربط متين مع Firebase.

4. تناقش معي باللغة العربية خطوة بخطوة ووضح لي ما ستؤديه قبل البدء أو أثناء الإصلاح.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://real-sync-fix.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3eeacb4d-9dd7-4579-8975-c5148abcea02).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
