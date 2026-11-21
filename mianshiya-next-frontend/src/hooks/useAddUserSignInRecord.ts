import {useEffect, useState} from "react";
import {message} from "antd";
import {addUserSignInUsingPost} from "@/api/userController";

const useAddUserSignInRecord = () => {
    const [loading, setLoading] = useState(true);
    const doFetch = async () => {
        setLoading(true);
        try {
            // 调用后端签到接口（昨天你写的那个）
            await addUserSignInUsingPost({});
        } catch (e: any) {
            message.error("打卡失败，" + e.message);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        doFetch();
    }, []); // 👈 注意这个空数组

    return { loading };
};

export default useAddUserSignInRecord;