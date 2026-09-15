
-- DOC-FULL-NR V17.6 FULL LEARNING SET
-- 11 subjects x 17 units; one logical worksheet pair per unit; 20-slide metadata;
-- Digital = on-time delivery, Paper = late/retroactive delivery, minimum 2 pages.
create temporary table _docnr_ext_topics(
  subject_code text not null,
  unit_no integer not null,
  topic text not null,
  primary key(subject_code,unit_no)
) on commit drop;

insert into _docnr_ext_topics(subject_code,unit_no,topic) values
("20001-1001",14,"ความปลอดภัยของเครื่องจักร เครื่องมือ และการตัดแหล่งพลังงาน"),
("20001-1001",15,"งานที่มีความเสี่ยงสูงและระบบอนุญาตทำงาน"),
("20001-1001",16,"โรคจากการทำงาน การเฝ้าระวังสุขภาพ และการส่งเสริมสุขภาพ"),
("20001-1001",17,"วัฒนธรรมความปลอดภัยและโครงงานบูรณาการสถานที่ทำงานปลอดภัย"),
("20001-1004",14,"ประกันสังคมและสิทธิประโยชน์ที่เกี่ยวข้องกับการทำงาน"),
("20001-1004",15,"ความปลอดภัย อาชีวอนามัย และความรับผิดชอบตามกฎหมาย"),
("20001-1004",16,"การจ้างงานรูปแบบใหม่ แรงงานแพลตฟอร์ม และข้อมูลส่วนบุคคลในการทำงาน"),
("20001-1004",17,"โครงงานวิเคราะห์ข้อพิพาทและจัดทำแนวปฏิบัติด้านแรงงานในสถานประกอบการ"),
("21900-1005",14,"ความมั่นคงปลอดภัยเครือข่าย Firewall และการควบคุมการเข้าถึง"),
("21900-1005",15,"IPv6 และการวางแผนระบบเลขที่อยู่เครือข่ายสมัยใหม่"),
("21900-1005",16,"การเฝ้าระวัง บันทึกเหตุการณ์ และวิเคราะห์ประสิทธิภาพเครือข่าย"),
("21900-1005",17,"โครงงานออกแบบ ติดตั้ง ทดสอบ และแก้ปัญหาระบบเครือข่ายแบบครบวงจร"),
("21901-2008",14,"Mobile-First และการออกแบบสำหรับ Touch Interface"),
("21901-2008",15,"แบบฟอร์ม สถานะข้อผิดพลาด และ Feedback ที่เข้าใจง่าย"),
("21901-2008",16,"Design Handoff และการตรวจคุณภาพหน้าจอก่อนพัฒนา"),
("21901-2008",17,"โครงงาน UI/UX ตั้งแต่การวิเคราะห์ผู้ใช้จนถึง Prototype ที่ทดสอบได้"),
("21901-2017",14,"ETL และ Data Pipeline สำหรับงานนำเข้าข้อมูล"),
("21901-2017",15,"การแปลง Mapping และมาตรฐานข้อมูลก่อนนำเข้า"),
("21901-2017",16,"Logging Monitoring Recovery และการป้องกันข้อมูลนำเข้าซ้ำ"),
("21901-2017",17,"โครงงานระบบนำเข้าข้อมูลอัตโนมัติแบบครบวงจร"),
("21901-2020",14,"การสนับสนุนผู้ใช้ระยะไกลและเครื่องมือ Remote Support"),
("21901-2020",15,"ความปลอดภัย ความเป็นส่วนตัว และการสำรองข้อมูลในงานบริการ"),
("21901-2020",16,"ตัวชี้วัดคุณภาพบริการ KPI และการปรับปรุงงานอย่างต่อเนื่อง"),
("21901-2020",17,"โครงงานบริการคอมพิวเตอร์ครบวงจรตั้งแต่รับแจ้งจนส่งมอบ"),
("21910-2010",14,"การอ่านเขียนไฟล์และการจัดเก็บข้อมูลถาวร"),
("21910-2010",15,"การจัดการข้อผิดพลาด Exception และการตรวจสอบข้อมูล"),
("21910-2010",16,"โครงสร้างข้อมูลพื้นฐานและการเลือกใช้ให้เหมาะกับปัญหา"),
("21910-2010",17,"Final Project การพัฒนาโปรแกรมพร้อมทดสอบและจัดทำเอกสาร"),
("31901-2001",14,"A/B Testing และการออกแบบการทดลองด้าน UX"),
("31901-2001",15,"Behavior Analytics Event Tracking และการแปลผลพฤติกรรมผู้ใช้"),
("31901-2001",16,"Design Token Handoff และการกำกับดูแล Design System"),
("31901-2001",17,"Capstone UX/UI ขั้นสูงจาก Research สู่ Prototype และการวัดผล"),
("31901-2004",14,"State Management และ Client-Side Storage"),
("31901-2004",15,"Front-End Testing: Unit Integration และ End-to-End"),
("31901-2004",16,"Web Security และ Production Hardening สำหรับ Front-End"),
("31901-2004",17,"Capstone SPA/PWA ตั้งแต่พัฒนาจน Deploy ใช้งานจริง"),
("31901-2009",14,"Background Task การ Sync และงานที่ทำต่อเนื่องบนอุปกรณ์"),
("31901-2009",15,"Authentication Secure Storage และการปกป้องข้อมูลผู้ใช้"),
("31901-2009",16,"CI/CD Quality Gate และกระบวนการ Release แอป"),
("31901-2009",17,"Capstone Mobile App ที่รวม Offline API และ Device Features"),
("31910-0004",14,"การจัดการไฟล์และข้อมูลถาวร"),
("31910-0004",15,"การเขียนโปรแกรมเชิงวัตถุและการออกแบบคลาส"),
("31910-0004",16,"โครงสร้างข้อมูล การค้นหา และการเรียงลำดับ"),
("31910-0004",17,"โครงงานโปรแกรมบูรณาการพร้อมทดสอบและเอกสารประกอบ");

create temporary table _docnr_units on commit drop as
with subjects as (
  select s.id subject_id,s.code subject_code,s.name subject_name
  from public.subjects s
  where s.active=true and s.subject_type='subject'
),
existing_digital as (
  select w.subject_id,private.docnr_unit_no(w.settings) unit_no,w.title,
         nullif(trim(coalesce(w.settings->>'unit_topic','')),'') unit_topic,
         nullif(trim(coalesce(w.settings->>'learning_goal','')),'') learning_goal
  from public.worksheets w
  where w.mode='digital' and w.reference_code is not null
    and coalesce((w.settings->>'template_ready')::boolean,false)=true
),
all_units as (
  select s.subject_id,s.subject_code,s.subject_name,g.unit_no,
    coalesce(
      ed.unit_topic,
      nullif(trim(regexp_replace(ed.title,'^ใบงานอิเล็กทรอนิกส์[[:space:]]*[0-9]+[[:space:]]*:[[:space:]]*','','i')),''),
      x.topic
    ) topic,
    ed.learning_goal existing_goal
  from subjects s cross join generate_series(1,17) g(unit_no)
  left join existing_digital ed on ed.subject_id=s.subject_id and ed.unit_no=g.unit_no
  left join _docnr_ext_topics x on x.subject_code=s.subject_code and x.unit_no=g.unit_no
)
select subject_id,subject_code,subject_name,unit_no,topic,
  coalesce(existing_goal,format('อธิบายหลักการ วิเคราะห์สถานการณ์ และประยุกต์ใช้เรื่อง “%s” ในรายวิชา %s ได้อย่างเป็นระบบ',topic,subject_name)) learning_goal,
  case
    when subject_code='20001-1001' then 'safety'
    when subject_code='20001-1004' then 'law'
    when subject_code='21900-1005' then 'network'
    when subject_code in ('21901-2008','31901-2001') then 'ui'
    when subject_code='21901-2017' then 'data'
    when subject_code='21901-2020' then 'service'
    when subject_code in ('21910-2010','31910-0004') then 'programming'
    when subject_code='31901-2004' then 'frontend'
    when subject_code='31901-2009' then 'mobile'
    else 'general'
  end category
from all_units
where topic is not null;

do $$
begin
  if (select count(*) from _docnr_units) <> 187 then
    raise exception 'V176_UNIT_MAP_INCOMPLETE: expected 187 units, got %',(select count(*) from _docnr_units);
  end if;
end $$;

-- Digital templates: 17 per subject.
insert into public.worksheets(
  subject_id,title,description,instructions,mode,status,questions,allow_late,allow_resubmit,max_attempts,
  allow_draft,copy_paste_allowed,paper_code_kind,reference_code,settings
)
select
  u.subject_id,
  format('ใบงานอิเล็กทรอนิกส์ %s : %s',lpad(u.unit_no::text,2,'0'),u.topic),
  format('ใบงานประจำหน่วยที่ %s สำหรับส่งภายในกำหนดเวลา • เนื้อหาสัมพันธ์กับสไลด์ 20 หน้าเรื่อง %s',u.unit_no,u.topic),
  'ศึกษาสไลด์ประจำหน่วยให้ครบ ทำกิจกรรมตามลำดับ และพิมพ์คำตอบด้วยตนเองให้ครบทุกข้อ ก่อนตรวจทานและยืนยันส่งภายในเวลาที่กำหนด',
  'digital','archived',
  jsonb_build_array(
    jsonb_build_object('id',format('d%02sq1',u.unit_no),'type','textarea','points',1,'required',true,'options','[]'::jsonb,'text',format('อธิบายความหมายและความสำคัญของ “%s” ในรายวิชา %s ด้วยภาษาของตนเอง',u.topic,u.subject_name)),
    jsonb_build_object('id',format('d%02sq2',u.unit_no),'type','textarea','points',2,'required',true,'options','[]'::jsonb,'text',
      case u.category
        when 'law' then format('ระบุสิทธิ หน้าที่ เงื่อนไข หรือหลักเกณฑ์สำคัญที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'network' then format('ระบุองค์ประกอบ อุปกรณ์ โปรโตคอล หรือค่ากำหนดที่สำคัญของ “%s” อย่างน้อย 3 รายการ',u.topic)
        when 'programming' then format('ระบุโครงสร้าง คำสั่ง ข้อมูลนำเข้า/ผลลัพธ์ หรือแนวคิดการเขียนโปรแกรมที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'frontend' then format('ระบุองค์ประกอบ HTML/CSS/JavaScript/เครื่องมือที่เกี่ยวข้องกับ “%s” และหน้าที่ของแต่ละส่วน',u.topic)
        when 'mobile' then format('ระบุองค์ประกอบของแอป ข้อมูล Permission หรือบริการอุปกรณ์ที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'ui' then format('ระบุหลักการออกแบบ ผู้ใช้เป้าหมาย และองค์ประกอบหน้าจอที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'data' then format('ระบุแหล่งข้อมูล รูปแบบข้อมูล และกฎตรวจสอบที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'service' then format('ระบุขั้นตอน เครื่องมือ และข้อมูลที่ต้องบันทึกในงานบริการเรื่อง “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'safety' then format('ระบุอันตราย ปัจจัยเสี่ยง และมาตรการควบคุมที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        else format('ระบุองค์ประกอบและหลักการสำคัญของ “%s” อย่างน้อย 3 ประเด็น',u.topic)
      end),
    jsonb_build_object('id',format('d%02sq3',u.unit_no),'type','textarea','points',2,'required',true,'options','[]'::jsonb,'text',format('วิเคราะห์สถานการณ์ตัวอย่างที่เกี่ยวข้องกับ “%s” ระบุปัญหา/สาเหตุ และอธิบายเหตุผลของแนวทางแก้ไข',u.topic)),
    jsonb_build_object('id',format('d%02sq4',u.unit_no),'type','textarea','points',2,'required',true,'options','[]'::jsonb,'text',format('เขียนลำดับขั้นตอนการปฏิบัติเรื่อง “%s” ตั้งแต่เริ่มต้นจนตรวจสอบผลอย่างน้อย 4 ขั้นตอน',u.topic)),
    jsonb_build_object('id',format('d%02sq5',u.unit_no),'type','textarea','points',2,'required',true,'options','[]'::jsonb,'text',format('ยกตัวอย่างการประยุกต์ใช้ “%s” ในงานจริง 1 กรณี พร้อมระบุเกณฑ์ตรวจสอบว่าผลลัพธ์ถูกต้องหรือเหมาะสม',u.topic)),
    jsonb_build_object('id',format('d%02sq6',u.unit_no),'type','textarea','points',1,'required',true,'options','[]'::jsonb,'text',format('สรุป Checklist 3–5 ข้อที่ควรจำก่อนนำ “%s” ไปใช้จริง',u.topic))
  ),
  false,false,1,true,false,'barcode',
  format('NR-%s-D%s',replace(u.subject_code,'-',''),lpad(u.unit_no::text,2,'0')),
  jsonb_build_object(
    'semester','1/2569','seed_batch','v176_all_subjects_17unit','sequence_no',u.unit_no,'lesson_sequence',u.unit_no,'week_no',u.unit_no,
    'template_ready',true,'unit_topic',u.topic,'learning_goal',u.learning_goal,'slide_pages',20,'page_count',2,'digital_pages',2,
    'work_pair_key',format('%s-U%s',u.subject_code,lpad(u.unit_no::text,2,'0')),'delivery_mode','on_time_digital',
    'manual_typing_only',true,'fullscreen_required',true,'preview_before_submit',true,
    'key_concepts',
      case u.category
        when 'safety' then jsonb_build_array(u.topic,'อันตรายและปัจจัยเสี่ยง','มาตรการควบคุม','การปฏิบัติอย่างปลอดภัย','การตรวจติดตาม')
        when 'law' then jsonb_build_array(u.topic,'สิทธิและหน้าที่','เงื่อนไขตามกฎหมาย','การปฏิบัติให้ถูกต้อง','การวิเคราะห์กรณี')
        when 'network' then jsonb_build_array(u.topic,'องค์ประกอบเครือข่าย','การกำหนดค่า','การทดสอบและวัดผล','ความปลอดภัยและการแก้ปัญหา')
        when 'ui' then jsonb_build_array(u.topic,'ผู้ใช้และบริบท','โครงสร้างข้อมูลและ Flow','Visual/Interaction','Accessibility/Usability')
        when 'data' then jsonb_build_array(u.topic,'แหล่งและรูปแบบข้อมูล','Validation/Mapping','การแปลงและจัดเก็บ','คุณภาพ ความปลอดภัย และการตรวจสอบ')
        when 'service' then jsonb_build_array(u.topic,'การรับงานและวิเคราะห์','เครื่องมือและขั้นตอนบริการ','การบันทึกและสื่อสาร','คุณภาพและความปลอดภัย')
        when 'programming' then jsonb_build_array(u.topic,'ข้อมูลและตัวแปร','โครงสร้างคำสั่ง/ตรรกะ','การแบ่งปัญหาเป็นขั้นตอน','การทดสอบและ Debug')
        when 'frontend' then jsonb_build_array(u.topic,'HTML/โครงสร้าง','CSS/Layout/Responsive','JavaScript/State/Event','Testing/Accessibility/Performance')
        when 'mobile' then jsonb_build_array(u.topic,'Mobile UI/Lifecycle','State/Storage/API','Permission/Device Feature','Security/Testing/Release')
        else jsonb_build_array(u.topic,'องค์ประกอบสำคัญ','ขั้นตอนปฏิบัติ','การประยุกต์ใช้','การตรวจสอบผล')
      end,
    'practice_steps',
      case u.category
        when 'law' then jsonb_build_array('อ่านข้อเท็จจริง','แยกประเด็นสิทธิและหน้าที่','ตรวจหลักเกณฑ์ที่เกี่ยวข้อง','วิเคราะห์ทางเลือก','สรุปแนวปฏิบัติ')
        when 'network' then jsonb_build_array('สำรวจความต้องการ','ออกแบบ/กำหนดค่า','เชื่อมต่อและทดสอบ','วิเคราะห์ผล','บันทึกและแก้ปัญหา')
        when 'programming' then jsonb_build_array('วิเคราะห์โจทย์','ออกแบบขั้นตอนวิธี','เขียนโปรแกรม','ทดสอบและ Debug','ปรับปรุงและจัดทำเอกสาร')
        when 'frontend' then jsonb_build_array('วิเคราะห์ UI/ข้อมูล','สร้างโครงสร้าง','พัฒนา Style/Interaction','ทดสอบ Responsive/Accessibility','ตรวจคุณภาพและ Deploy')
        when 'mobile' then jsonb_build_array('กำหนด Use Case','ออกแบบหน้าจอ/State','เชื่อมข้อมูลหรือ Device Feature','ทดสอบบนอุปกรณ์','แก้ปัญหาและเตรียม Release')
        when 'ui' then jsonb_build_array('ศึกษาผู้ใช้','จัดโครงสร้าง/Flow','สร้าง Wireframe/Prototype','ทดสอบกับผู้ใช้','ปรับปรุงจาก Feedback')
        when 'data' then jsonb_build_array('สำรวจแหล่งข้อมูล','กำหนด Schema/Validation','นำเข้าและแปลงข้อมูล','ตรวจข้อผิดพลาด/ข้อมูลซ้ำ','ยืนยันคุณภาพและบันทึก Log')
        when 'service' then jsonb_build_array('รับแจ้งและบันทึก','วิเคราะห์สาเหตุ','ดำเนินการแก้ไข','ทดสอบผล','บันทึกและส่งมอบ')
        when 'safety' then jsonb_build_array('สำรวจอันตราย','ประเมินผลกระทบ','เลือกมาตรการควบคุม','ปฏิบัติและสื่อสาร','ติดตามผลและปรับปรุง')
        else jsonb_build_array('วิเคราะห์งาน','เตรียมข้อมูล/เครื่องมือ','ลงมือปฏิบัติ','ตรวจสอบผล','สรุปและปรับปรุง')
      end,
    'case_study',format('สถานการณ์ปฏิบัติงานเกี่ยวกับ “%s” ในบริบทของรายวิชา %s ซึ่งผู้เรียนต้องวิเคราะห์ปัญหาและเลือกแนวทางดำเนินการที่เหมาะสม',u.topic,u.subject_name),
    'control_points',jsonb_build_array('ตรวจข้อมูลและเงื่อนไขก่อนเริ่ม','ปฏิบัติตามลำดับขั้น','ตรวจข้อผิดพลาดระหว่างทำ','ตรวจผลลัพธ์เทียบเกณฑ์','บันทึกและสรุปสิ่งที่ต้องปรับปรุง'),
    'exit_questions',jsonb_build_array(format('สาระสำคัญที่สุดของ “%s” คืออะไร',u.topic),format('ถ้าพบปัญหาในงานที่เกี่ยวกับ “%s” คุณจะเริ่มตรวจจากจุดใด',u.topic),format('คุณจะใช้เกณฑ์ใดตัดสินว่างานเรื่อง “%s” ทำได้ถูกต้อง',u.topic))
  )
from _docnr_units u
on conflict(reference_code) where reference_code is not null do update
set subject_id=excluded.subject_id,title=excluded.title,description=excluded.description,instructions=excluded.instructions,
    questions=excluded.questions,allow_late=false,allow_resubmit=false,max_attempts=1,allow_draft=true,copy_paste_allowed=false,
    paper_code_kind='barcode',settings=coalesce(public.worksheets.settings,'{}'::jsonb)||excluded.settings,updated_at=clock_timestamp();

-- Paper templates: one paired late-delivery version for every unit.
insert into public.worksheets(
  subject_id,title,description,instructions,mode,status,questions,allow_late,allow_resubmit,max_attempts,
  allow_draft,copy_paste_allowed,paper_code_kind,reference_code,settings
)
select
  u.subject_id,
  format('ใบงานพิมพ์ย้อนหลัง %s : %s',lpad(u.unit_no::text,2,'0'),u.topic),
  format('ใบงานรายบุคคลสำหรับส่งย้อนหลังของหน่วยที่ %s • อย่างน้อย 2 หน้า • เนื้อหาเดียวกับใบงานอิเล็กทรอนิกส์และสไลด์เรื่อง %s',u.unit_no,u.topic),
  'ใบงานนี้ใช้สำหรับผู้เรียนที่พ้นกำหนดส่งออนไลน์เท่านั้น ให้พิมพ์ฉบับรายบุคคลพร้อม Barcode เขียนคำตอบด้วยลายมือให้ครบ และส่งฉบับจริงแก่ผู้สอน',
  'paper','archived',
  jsonb_build_array(
    jsonb_build_object('id',format('p%02sq1',u.unit_no),'type','textarea','points',1,'required',true,'options','[]'::jsonb,'text',format('อธิบายความหมายและความสำคัญของ “%s” ในรายวิชา %s ด้วยภาษาของตนเอง',u.topic,u.subject_name)),
    jsonb_build_object('id',format('p%02sq2',u.unit_no),'type','textarea','points',2,'required',true,'options','[]'::jsonb,'text',
      case u.category
        when 'law' then format('ระบุสิทธิ หน้าที่ เงื่อนไข หรือหลักเกณฑ์สำคัญที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'network' then format('ระบุองค์ประกอบ อุปกรณ์ โปรโตคอล หรือค่ากำหนดที่สำคัญของ “%s” อย่างน้อย 3 รายการ',u.topic)
        when 'programming' then format('ระบุโครงสร้าง คำสั่ง ข้อมูลนำเข้า/ผลลัพธ์ หรือแนวคิดการเขียนโปรแกรมที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'frontend' then format('ระบุองค์ประกอบ HTML/CSS/JavaScript/เครื่องมือที่เกี่ยวข้องกับ “%s” และหน้าที่ของแต่ละส่วน',u.topic)
        when 'mobile' then format('ระบุองค์ประกอบของแอป ข้อมูล Permission หรือบริการอุปกรณ์ที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'ui' then format('ระบุหลักการออกแบบ ผู้ใช้เป้าหมาย และองค์ประกอบหน้าจอที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'data' then format('ระบุแหล่งข้อมูล รูปแบบข้อมูล และกฎตรวจสอบที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'service' then format('ระบุขั้นตอน เครื่องมือ และข้อมูลที่ต้องบันทึกในงานบริการเรื่อง “%s” อย่างน้อย 3 ประเด็น',u.topic)
        when 'safety' then format('ระบุอันตราย ปัจจัยเสี่ยง และมาตรการควบคุมที่เกี่ยวข้องกับ “%s” อย่างน้อย 3 ประเด็น',u.topic)
        else format('ระบุองค์ประกอบและหลักการสำคัญของ “%s” อย่างน้อย 3 ประเด็น',u.topic)
      end),
    jsonb_build_object('id',format('p%02sq3',u.unit_no),'type','textarea','points',2,'required',true,'options','[]'::jsonb,'text',format('วิเคราะห์สถานการณ์ตัวอย่างที่เกี่ยวข้องกับ “%s” ระบุปัญหา/สาเหตุ และอธิบายเหตุผลของแนวทางแก้ไข',u.topic)),
    jsonb_build_object('id',format('p%02sq4',u.unit_no),'type','textarea','points',2,'required',true,'options','[]'::jsonb,'text',format('เขียนลำดับขั้นตอนการปฏิบัติเรื่อง “%s” ตั้งแต่เริ่มต้นจนตรวจสอบผลอย่างน้อย 4 ขั้นตอน',u.topic)),
    jsonb_build_object('id',format('p%02sq5',u.unit_no),'type','textarea','points',2,'required',true,'options','[]'::jsonb,'text',format('ยกตัวอย่างการประยุกต์ใช้ “%s” ในงานจริง 1 กรณี พร้อมระบุเกณฑ์ตรวจสอบว่าผลลัพธ์ถูกต้องหรือเหมาะสม',u.topic)),
    jsonb_build_object('id',format('p%02sq6',u.unit_no),'type','textarea','points',1,'required',true,'options','[]'::jsonb,'text',format('สรุป Checklist 3–5 ข้อที่ควรจำก่อนนำ “%s” ไปใช้จริง',u.topic))
  ),
  false,false,1,false,false,'barcode',
  format('NR-%s-P%s',replace(u.subject_code,'-',''),lpad(u.unit_no::text,2,'0')),
  jsonb_build_object(
    'semester','1/2569','seed_batch','v176_all_subjects_17unit','sequence_no',u.unit_no,'lesson_sequence',u.unit_no,'week_no',u.unit_no,
    'template_ready',true,'unit_topic',u.topic,'learning_goal',u.learning_goal,'slide_pages',20,'page_size','A4','page_count',2,'paper_min_pages',2,'paper_one_page',false,'formal_code','FM-AC-01',
    'work_pair_key',format('%s-U%s',u.subject_code,lpad(u.unit_no::text,2,'0')),'delivery_mode','late_paper_only',
    'key_concepts',
      case u.category
        when 'safety' then jsonb_build_array(u.topic,'อันตรายและปัจจัยเสี่ยง','มาตรการควบคุม','การปฏิบัติอย่างปลอดภัย','การตรวจติดตาม')
        when 'law' then jsonb_build_array(u.topic,'สิทธิและหน้าที่','เงื่อนไขตามกฎหมาย','การปฏิบัติให้ถูกต้อง','การวิเคราะห์กรณี')
        when 'network' then jsonb_build_array(u.topic,'องค์ประกอบเครือข่าย','การกำหนดค่า','การทดสอบและวัดผล','ความปลอดภัยและการแก้ปัญหา')
        when 'ui' then jsonb_build_array(u.topic,'ผู้ใช้และบริบท','โครงสร้างข้อมูลและ Flow','Visual/Interaction','Accessibility/Usability')
        when 'data' then jsonb_build_array(u.topic,'แหล่งและรูปแบบข้อมูล','Validation/Mapping','การแปลงและจัดเก็บ','คุณภาพ ความปลอดภัย และการตรวจสอบ')
        when 'service' then jsonb_build_array(u.topic,'การรับงานและวิเคราะห์','เครื่องมือและขั้นตอนบริการ','การบันทึกและสื่อสาร','คุณภาพและความปลอดภัย')
        when 'programming' then jsonb_build_array(u.topic,'ข้อมูลและตัวแปร','โครงสร้างคำสั่ง/ตรรกะ','การแบ่งปัญหาเป็นขั้นตอน','การทดสอบและ Debug')
        when 'frontend' then jsonb_build_array(u.topic,'HTML/โครงสร้าง','CSS/Layout/Responsive','JavaScript/State/Event','Testing/Accessibility/Performance')
        when 'mobile' then jsonb_build_array(u.topic,'Mobile UI/Lifecycle','State/Storage/API','Permission/Device Feature','Security/Testing/Release')
        else jsonb_build_array(u.topic,'องค์ประกอบสำคัญ','ขั้นตอนปฏิบัติ','การประยุกต์ใช้','การตรวจสอบผล')
      end,
    'practice_steps',
      case u.category
        when 'law' then jsonb_build_array('อ่านข้อเท็จจริง','แยกประเด็นสิทธิและหน้าที่','ตรวจหลักเกณฑ์ที่เกี่ยวข้อง','วิเคราะห์ทางเลือก','สรุปแนวปฏิบัติ')
        when 'network' then jsonb_build_array('สำรวจความต้องการ','ออกแบบ/กำหนดค่า','เชื่อมต่อและทดสอบ','วิเคราะห์ผล','บันทึกและแก้ปัญหา')
        when 'programming' then jsonb_build_array('วิเคราะห์โจทย์','ออกแบบขั้นตอนวิธี','เขียนโปรแกรม','ทดสอบและ Debug','ปรับปรุงและจัดทำเอกสาร')
        when 'frontend' then jsonb_build_array('วิเคราะห์ UI/ข้อมูล','สร้างโครงสร้าง','พัฒนา Style/Interaction','ทดสอบ Responsive/Accessibility','ตรวจคุณภาพและ Deploy')
        when 'mobile' then jsonb_build_array('กำหนด Use Case','ออกแบบหน้าจอ/State','เชื่อมข้อมูลหรือ Device Feature','ทดสอบบนอุปกรณ์','แก้ปัญหาและเตรียม Release')
        when 'ui' then jsonb_build_array('ศึกษาผู้ใช้','จัดโครงสร้าง/Flow','สร้าง Wireframe/Prototype','ทดสอบกับผู้ใช้','ปรับปรุงจาก Feedback')
        when 'data' then jsonb_build_array('สำรวจแหล่งข้อมูล','กำหนด Schema/Validation','นำเข้าและแปลงข้อมูล','ตรวจข้อผิดพลาด/ข้อมูลซ้ำ','ยืนยันคุณภาพและบันทึก Log')
        when 'service' then jsonb_build_array('รับแจ้งและบันทึก','วิเคราะห์สาเหตุ','ดำเนินการแก้ไข','ทดสอบผล','บันทึกและส่งมอบ')
        when 'safety' then jsonb_build_array('สำรวจอันตราย','ประเมินผลกระทบ','เลือกมาตรการควบคุม','ปฏิบัติและสื่อสาร','ติดตามผลและปรับปรุง')
        else jsonb_build_array('วิเคราะห์งาน','เตรียมข้อมูล/เครื่องมือ','ลงมือปฏิบัติ','ตรวจสอบผล','สรุปและปรับปรุง')
      end,
    'case_study',format('สถานการณ์ปฏิบัติงานเกี่ยวกับ “%s” ในบริบทของรายวิชา %s ซึ่งผู้เรียนต้องวิเคราะห์ปัญหาและเลือกแนวทางดำเนินการที่เหมาะสม',u.topic,u.subject_name),
    'control_points',jsonb_build_array('ตรวจข้อมูลและเงื่อนไขก่อนเริ่ม','ปฏิบัติตามลำดับขั้น','ตรวจข้อผิดพลาดระหว่างทำ','ตรวจผลลัพธ์เทียบเกณฑ์','บันทึกและสรุปสิ่งที่ต้องปรับปรุง'),
    'exit_questions',jsonb_build_array(format('สาระสำคัญที่สุดของ “%s” คืออะไร',u.topic),format('ถ้าพบปัญหาในงานที่เกี่ยวกับ “%s” คุณจะเริ่มตรวจจากจุดใด',u.topic),format('คุณจะใช้เกณฑ์ใดตัดสินว่างานเรื่อง “%s” ทำได้ถูกต้อง',u.topic))
  )
from _docnr_units u
on conflict(reference_code) where reference_code is not null do update
set subject_id=excluded.subject_id,title=excluded.title,description=excluded.description,instructions=excluded.instructions,
    questions=excluded.questions,allow_late=false,allow_resubmit=false,max_attempts=1,allow_draft=false,copy_paste_allowed=false,
    paper_code_kind='barcode',settings=coalesce(public.worksheets.settings,'{}'::jsonb)||excluded.settings,updated_at=clock_timestamp();

-- If a unit was already opened under the old system, keep the new paired Paper template synchronized and assigned.
with pairs as (
  select d.id digital_id,p.id paper_id,d.open_at,d.due_at,d.published_at,d.allow_resubmit,d.max_attempts
  from public.worksheets d
  join public.worksheets p on p.subject_id=d.subject_id
    and p.mode='paper' and d.mode='digital'
    and nullif(p.settings->>'work_pair_key','')=nullif(d.settings->>'work_pair_key','')
  where d.status='published' and d.reference_code is not null and p.reference_code is not null
)
update public.worksheets p
set status='published',open_at=x.open_at,due_at=x.due_at,published_at=coalesce(p.published_at,x.published_at,clock_timestamp()),
    allow_late=false,allow_resubmit=x.allow_resubmit,max_attempts=x.max_attempts,updated_at=clock_timestamp()
from pairs x where p.id=x.paper_id and p.status<>'published';

insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assigned_at,assignment_source,subject_enrollment_id)
select p.id,a.user_id,a.assigned_by,coalesce(a.assigned_at,clock_timestamp()),'work_pair',a.subject_enrollment_id
from public.worksheets d
join public.worksheets p on p.subject_id=d.subject_id and p.mode='paper' and d.mode='digital'
  and nullif(p.settings->>'work_pair_key','')=nullif(d.settings->>'work_pair_key','')
join public.worksheet_assignments a on a.worksheet_id=d.id
where d.status='published' and p.status='published'
on conflict(worksheet_id,user_id) do nothing;

-- Canonical assertions for the new design.
do $$
declare v_d int;v_p int;v_total int;v_subjects int;v_bad int;
begin
  select count(*) filter(where w.mode='digital'),count(*) filter(where w.mode='paper'),count(*)
    into v_d,v_p,v_total
  from public.worksheets w
  join public.subjects s on s.id=w.subject_id
  where s.active=true and s.subject_type='subject'
    and w.reference_code is not null and coalesce((w.settings->>'template_ready')::boolean,false)=true
    and coalesce(w.settings->>'seed_batch','')='v176_all_subjects_17unit';

  select count(distinct s.id) into v_subjects
  from public.subjects s
  where s.active=true and s.subject_type='subject';

  select count(*) into v_bad from (
    select s.id
    from public.subjects s
    left join public.worksheets w on w.subject_id=s.id and w.reference_code is not null
      and coalesce((w.settings->>'template_ready')::boolean,false)=true
      and coalesce(w.settings->>'seed_batch','')='v176_all_subjects_17unit'
    where s.active=true and s.subject_type='subject'
    group by s.id
    having count(*) filter(where w.mode='digital')<>17
        or count(*) filter(where w.mode='paper')<>17
        or max(private.docnr_unit_no(w.settings))<>17
        or min(coalesce((w.settings->>'slide_pages')::int,0))<20
        or min(coalesce((w.settings->>'page_count')::int,0))<2
  ) z;

  if v_subjects<>11 or v_d<>187 or v_p<>187 or v_total<>374 or v_bad<>0 then
    raise exception 'V176_TEMPLATE_ASSERTION_FAILED subjects=% digital=% paper=% total=% bad=%',v_subjects,v_d,v_p,v_total,v_bad;
  end if;
end $$;
