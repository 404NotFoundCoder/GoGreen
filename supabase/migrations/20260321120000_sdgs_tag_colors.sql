-- 與前端 constants/sdg.ts 的 SDG_COLORS 一致：
-- color = 標籤底色（官方色 + 8 位 hex 透明度 …18 ≈ 10%）
-- text_color = 標籤文字色（深色）
-- label = 與 UI 相同之簡短中文

update public.sdgs set label = '消除貧窮', color = '#E5243B18', text_color = '#8b0012' where id = 1;
update public.sdgs set label = '消除飢餓', color = '#DDA63A18', text_color = '#7a4f00' where id = 2;
update public.sdgs set label = '健康與福祉', color = '#4C9F3818', text_color = '#1e5015' where id = 3;
update public.sdgs set label = '優質教育', color = '#C5192D18', text_color = '#7a0010' where id = 4;
update public.sdgs set label = '性別平等', color = '#FF3A2118', text_color = '#991500' where id = 5;
update public.sdgs set label = '淨水及衛生', color = '#26BDE218', text_color = '#084d6d' where id = 6;
update public.sdgs set label = '潔淨能源', color = '#FCC30B18', text_color = '#6b4e00' where id = 7;
update public.sdgs set label = '尊嚴就業', color = '#A2194218', text_color = '#5c0020' where id = 8;
update public.sdgs set label = '產業創新', color = '#FD692518', text_color = '#8b3000' where id = 9;
update public.sdgs set label = '減少不平等', color = '#DD136718', text_color = '#7a0035' where id = 10;
update public.sdgs set label = '永續城鄉', color = '#FD9D2418', text_color = '#7a3d00' where id = 11;
update public.sdgs set label = '責任消費', color = '#BF8B2E18', text_color = '#5c3a00' where id = 12;
update public.sdgs set label = '氣候行動', color = '#3F7E4418', text_color = '#1a3d1e' where id = 13;
update public.sdgs set label = '保育海洋', color = '#0A97D918', text_color = '#084d6d' where id = 14;
update public.sdgs set label = '保育陸域', color = '#56C02B18', text_color = '#265c0a' where id = 15;
update public.sdgs set label = '和平正義', color = '#00689D18', text_color = '#003d5c' where id = 16;
update public.sdgs set label = '全球夥伴', color = '#19486A18', text_color = '#0d2a40' where id = 17;
